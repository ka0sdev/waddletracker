import * as vscode from "vscode";

import { ActivityTracker } from "../tracking/ActivityTracker";

import { CodingSession } from "../types/CodingSession";
import { DailyStats } from "../types/TrackerState";

import {
  formatDuration,
  formatLanguageName,
} from "../utils/formatters";

const PERIODIC_REFRESH_INTERVAL_MS =
  30_000;

type StatisticsNodeKind =
  | "section"
  | "stat"
  | "session";

interface StatisticsNode {
  kind: StatisticsNodeKind;

  label: string;
  description?: string;
  tooltip?: string;

  icon?: string;

  children?: StatisticsNode[];
}

interface TrackerSnapshot {
  active: boolean;

  projectName:
    | string
    | undefined;

  languageId:
    | string
    | undefined;

  sessionId:
    | string
    | undefined;
}

export class StatisticsTreeProvider
  implements
    vscode.TreeDataProvider<StatisticsNode>,
    vscode.Disposable
{
  private readonly onDidChangeTreeDataEmitter =
    new vscode.EventEmitter<
      StatisticsNode | undefined | void
    >();

  public readonly onDidChangeTreeData =
    this.onDidChangeTreeDataEmitter.event;

  private readonly disposables:
    vscode.Disposable[] = [];

  private periodicRefreshTimer:
    NodeJS.Timeout | undefined;

  private lastSnapshot:
    TrackerSnapshot;

  constructor(
    private readonly tracker:
      ActivityTracker,
  ) {
    this.lastSnapshot =
      this.createTrackerSnapshot();

    this.disposables.push(
      this.tracker.onDidUpdate(
        () => {
          this.handleTrackerUpdate();
        },
      ),

      vscode.workspace.onDidChangeConfiguration(
        (event) => {
          if (
            event.affectsConfiguration(
              "waddleTracker.sidebar",
            )
          ) {
            this.refresh();
          }
        },
      ),
    );

    this.startPeriodicRefresh();
  }

  public refresh(): void {
    this.lastSnapshot =
      this.createTrackerSnapshot();

    this.onDidChangeTreeDataEmitter.fire();
  }

  public getTreeItem(
    element: StatisticsNode,
  ): vscode.TreeItem {
    const hasChildren =
      Boolean(
        element.children?.length,
      );

    const item =
      new vscode.TreeItem(
        element.label,
        hasChildren
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.None,
      );

    item.description =
      element.description;

    item.tooltip =
      element.tooltip ??
      element.label;

    if (element.icon) {
      item.iconPath =
        new vscode.ThemeIcon(
          element.icon,
        );
    }

    return item;
  }

  public getChildren(
    element?: StatisticsNode,
  ): StatisticsNode[] {
    if (element) {
      return (
        element.children ??
        []
      );
    }

    return this.getRootNodes();
  }

  public dispose(): void {
    if (
      this.periodicRefreshTimer
    ) {
      clearInterval(
        this.periodicRefreshTimer,
      );

      this.periodicRefreshTimer =
        undefined;
    }

    for (
      const disposable
      of this.disposables
    ) {
      disposable.dispose();
    }

    this.onDidChangeTreeDataEmitter.dispose();
  }

  private handleTrackerUpdate(): void {
    const currentSnapshot =
      this.createTrackerSnapshot();

    if (
      !this.snapshotsEqual(
        this.lastSnapshot,
        currentSnapshot,
      )
    ) {
      this.lastSnapshot =
        currentSnapshot;

      this.onDidChangeTreeDataEmitter.fire();
    }
  }

  private startPeriodicRefresh(): void {
    this.periodicRefreshTimer =
      setInterval(
        () => {
          this.refresh();
        },
        PERIODIC_REFRESH_INTERVAL_MS,
      );
  }

  private createTrackerSnapshot():
    TrackerSnapshot {
    const context =
      this.tracker.getCurrentContext();

    const session =
      this.tracker.getCurrentSession();

    return {
      active:
        this.tracker.isActive(),

      projectName:
        context.projectName,

      languageId:
        context.languageId,

      sessionId:
        session?.id,
    };
  }

  private snapshotsEqual(
    first: TrackerSnapshot,
    second: TrackerSnapshot,
  ): boolean {
    return (
      first.active ===
        second.active &&
      first.projectName ===
        second.projectName &&
      first.languageId ===
        second.languageId &&
      first.sessionId ===
        second.sessionId
    );
  }

  private getRootNodes():
    StatisticsNode[] {
    const stats =
      this.tracker.getTodayStats();

    const context =
      this.tracker.getCurrentContext();

    const session =
      this.tracker.getCurrentSession();

    return [
      this.createCurrentSection(
        stats,
        session,
        context.projectName,
        context.languageId,
      ),

      this.createRecentSessionsSection(),
    ];
  }

  private createCurrentSection(
    stats: DailyStats,
    session:
      CodingSession | undefined,
    projectName:
      string | undefined,
    languageId:
      string | undefined,
  ): StatisticsNode {
    const active =
      this.tracker.isActive();

    const children:
      StatisticsNode[] = [
      {
        kind: "stat",

        label: "Status",

        description:
          active
            ? "Active"
            : "Idle",

        tooltip:
          active
            ? "WaddleTracker is currently recording coding activity."
            : "WaddleTracker is currently idle.",

        icon:
          active
            ? "pulse"
            : "circle-outline",
      },

      {
        kind: "stat",

        label: "Current session",

        description:
          session
            ? formatDuration(
                session.activeMilliseconds,
              )
            : "No active session",

        tooltip:
          session
            ? [
                `Current session: ${formatDuration(
                  session.activeMilliseconds,
                )}`,
                this.formatSessionRange(
                  session,
                ),
              ].join(
                "\n",
              )
            : "No coding session is currently active.",

        icon: "clock",
      },

      {
        kind: "stat",

        label: "Today",

        description:
          formatDuration(
            stats.activeMilliseconds,
          ),

        tooltip:
          `Total coding activity today: ${formatDuration(
            stats.activeMilliseconds,
          )}`,

        icon: "calendar",
      },
    ];

    if (projectName) {
      children.push({
        kind: "stat",

        label: "Project",

        description:
          projectName,

        tooltip:
          `Current project: ${projectName}`,

        icon: "folder",
      });
    }

    if (languageId) {
      const languageName =
        formatLanguageName(
          languageId,
        );

      children.push({
        kind: "stat",

        label: "Language",

        description:
          languageName,

        tooltip:
          `Current language: ${languageName}`,

        icon: "code",
      });
    }

    return {
      kind: "section",

      label: "Current",

      icon: "pulse",

      children,
    };
  }

  private createRecentSessionsSection():
    StatisticsNode {
    const limit =
      this.getRecentSessionLimit();

    const sessions =
      [...this.tracker.getSessions()]
        .slice(
          -limit,
        )
        .reverse()
        .map(
          (
            session,
          ): StatisticsNode => {
            const project =
              session.projectName ??
              "Unknown project";

            const state =
              session.endedAt
                ? "Completed"
                : "Active";

            const duration =
              formatDuration(
                session.activeMilliseconds,
              );

            return {
              kind: "session",

              label:
                project,

              description:
                duration,

              tooltip:
                [
                  project,
                  `Status: ${state}`,
                  `Duration: ${duration}`,
                  this.formatSessionRange(
                    session,
                  ),
                ].join(
                  "\n",
                ),

              icon:
                session.endedAt
                  ? "history"
                  : "pulse",
            };
          },
        );

    return {
      kind: "section",

      label: "Recent Sessions",

      icon: "history",

      children:
        sessions.length > 0
          ? sessions
          : [
              {
                kind: "stat",

                label:
                  "No sessions recorded yet",

                tooltip:
                  "Coding sessions will appear here once WaddleTracker records activity.",

                icon: "info",
              },
            ],
    };
  }

  private getRecentSessionLimit():
    number {
    const configuration =
      vscode.workspace.getConfiguration(
        "waddleTracker",
      );

    return configuration.get<number>(
      "sidebar.recentSessions",
      5,
    );
  }

  private formatSessionRange(
    session: CodingSession,
  ): string {
    const started =
      new Date(
        session.startedAt,
      );

    const ended =
      session.endedAt
        ? new Date(
            session.endedAt,
          )
        : undefined;

    const startLabel =
      started.toLocaleTimeString(
        undefined,
        {
          hour: "2-digit",
          minute: "2-digit",
        },
      );

    if (!ended) {
      return `${startLabel} → now`;
    }

    const endLabel =
      ended.toLocaleTimeString(
        undefined,
        {
          hour: "2-digit",
          minute: "2-digit",
        },
      );

    return (
      `${startLabel} → ${endLabel}`
    );
  }
}
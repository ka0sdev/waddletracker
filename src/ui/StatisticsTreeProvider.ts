import * as vscode from "vscode";

import { ActivityTracker } from "../tracking/ActivityTracker";

import { CodingSession } from "../types/CodingSession";

import {
  DailyDimensionStats,
  DailyStats,
} from "../types/TrackerState";

import {
  formatDuration,
  formatLanguageName,
  formatPercentage,
} from "../utils/formatters";

type StatisticsNodeKind =
  | "section"
  | "stat"
  | "project"
  | "language"
  | "session";

interface StatisticsNode {
  kind: StatisticsNodeKind;

  label: string;
  description?: string;
  tooltip?: string;

  icon?: string;

  children?: StatisticsNode[];
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

  constructor(
    private readonly tracker:
      ActivityTracker,
  ) {
    this.disposables.push(
      this.tracker.onDidUpdate(
        () => {
          this.refresh();
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
  }

  public refresh(): void {
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
    for (
      const disposable
      of this.disposables
    ) {
      disposable.dispose();
    }

    this.onDidChangeTreeDataEmitter.dispose();
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
      this.createOverviewSection(
        stats,
        session,
        context.projectName,
        context.languageId,
      ),

      this.createProjectsSection(
        stats,
      ),

      this.createLanguagesSection(
        stats,
      ),

      this.createRecentSessionsSection(),
    ];
  }

  private createOverviewSection(
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
        icon: "clock",
      },

      {
        kind: "stat",
        label: "Today",
        description:
          formatDuration(
            stats.activeMilliseconds,
          ),
        icon: "calendar",
      },
    ];

    if (projectName) {
      children.push({
        kind: "stat",
        label: "Project",
        description:
          projectName,
        icon: "folder",
      });
    }

    if (languageId) {
      children.push({
        kind: "stat",
        label: "Language",
        description:
          formatLanguageName(
            languageId,
          ),
        icon: "code",
      });
    }

    return {
      kind: "section",
      label: "Overview",
      icon: "dashboard",
      children,
    };
  }

  private createProjectsSection(
    stats: DailyStats,
  ): StatisticsNode {
    const projects =
      this.createDimensionNodes(
        stats.projects,
        "project",
        "folder",
        stats.activeMilliseconds,
      );

    return {
      kind: "section",
      label: "Today's Projects",
      icon: "folder-library",

      children:
        projects.length > 0
          ? projects
          : [
              {
                kind: "stat",
                label:
                  "No project activity yet",
                icon: "info",
              },
            ],
    };
  }

  private createLanguagesSection(
    stats: DailyStats,
  ): StatisticsNode {
    const languages =
      Object.entries(
        stats.languages,
      )
        .sort(
          (
            [, first],
            [, second],
          ) =>
            second.activeMilliseconds -
            first.activeMilliseconds,
        )
        .map(
          (
            [language, value],
          ): StatisticsNode => {
            const duration =
              formatDuration(
                value.activeMilliseconds,
              );

            const percentage =
              formatPercentage(
                value.activeMilliseconds,
                stats.activeMilliseconds,
              );

            return {
              kind: "language",

              label:
                formatLanguageName(
                  language,
                ),

              description:
                `${duration} • ${percentage}`,

              tooltip:
                [
                  formatLanguageName(
                    language,
                  ),
                  `Time: ${duration}`,
                  `Share of today: ${percentage}`,
                ].join(
                  "\n",
                ),

              icon: "code",
            };
          },
        );

    return {
      kind: "section",
      label: "Today's Languages",
      icon: "symbol-keyword",

      children:
        languages.length > 0
          ? languages
          : [
              {
                kind: "stat",
                label:
                  "No language activity yet",
                icon: "info",
              },
            ],
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
                icon: "info",
              },
            ],
    };
  }

  private createDimensionNodes(
    dimensions: Record<
      string,
      DailyDimensionStats
    >,
    kind:
      | "project"
      | "language",
    icon: string,
    totalMilliseconds: number,
  ): StatisticsNode[] {
    return Object.entries(
      dimensions,
    )
      .sort(
        (
          [, first],
          [, second],
        ) =>
          second.activeMilliseconds -
          first.activeMilliseconds,
      )
      .map(
        (
          [name, value],
        ): StatisticsNode => {
          const duration =
            formatDuration(
              value.activeMilliseconds,
            );

          const percentage =
            formatPercentage(
              value.activeMilliseconds,
              totalMilliseconds,
            );

          return {
            kind,

            label:
              name,

            description:
              `${duration} • ${percentage}`,

            tooltip:
              [
                name,
                `Time: ${duration}`,
                `Share of today: ${percentage}`,
              ].join(
                "\n",
              ),

            icon,
          };
        },
      );
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
      return (
        `${startLabel} → now`
      );
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
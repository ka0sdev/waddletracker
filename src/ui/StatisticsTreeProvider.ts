import * as vscode from "vscode";

import { StatisticsService } from "../statistics/StatisticsService";
import { HistoricalStatistics } from "../types/StatisticsTypes";

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

const PERIODIC_REFRESH_INTERVAL_MS =
  30_000;

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

    private readonly statisticsService:
      StatisticsService,
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
      this.createOverviewSection(
        stats,
        session,
        context.projectName,
        context.languageId,
      ),

      this.createHistoricalSection(),

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

  private createHistoricalSection():
    StatisticsNode {
    const history =
      this.tracker.getDailyHistory();

    const sevenDays =
      this.statisticsService.getStatistics(
        history,
        "7days",
      );

    const thirtyDays =
      this.statisticsService.getStatistics(
        history,
        "30days",
      );

    const allTime =
      this.statisticsService.getStatistics(
        history,
        "all",
      );

    return {
      kind: "section",
      label: "History",
      icon: "graph",

      children: [
        {
          kind: "stat",
          label: "Last 7 days",
          description:
            formatDuration(
              sevenDays.activeMilliseconds,
            ),
          tooltip:
            this.createHistoricalTooltip(
              sevenDays,
            ),
          icon: "calendar",
        },

        {
          kind: "stat",
          label: "Last 30 days",
          description:
            formatDuration(
              thirtyDays.activeMilliseconds,
            ),
          tooltip:
            this.createHistoricalTooltip(
              thirtyDays,
            ),
          icon: "calendar",
        },

        {
          kind: "stat",
          label: "All time",
          description:
            formatDuration(
              allTime.activeMilliseconds,
            ),
          tooltip:
            this.createHistoricalTooltip(
              allTime,
            ),
          icon: "history",
        },
      ],
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

          const displayName =
            kind === "language"
              ? formatLanguageName(
                  name,
                )
              : name;

          return {
            kind,

            label:
              displayName,

            description:
              `${duration} • ${percentage}`,

            tooltip:
              [
                displayName,
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

  private createHistoricalTooltip(
    statistics:
      HistoricalStatistics,
  ): string {
    const lines = [
      `Total: ${formatDuration(
        statistics.activeMilliseconds,
      )}`,

      `Active days: ${statistics.activeDays}`,

      `Average: ${formatDuration(
        statistics.averageActiveMilliseconds,
      )} per active day`,
    ];

    if (
      statistics.bestDay
    ) {
      lines.push(
        `Best day: ${statistics.bestDay.date} (${formatDuration(
          statistics.bestDay.activeMilliseconds,
        )})`,
      );
    }

    if (
      statistics.projects[0]
    ) {
      lines.push(
        `Top project: ${statistics.projects[0].name}`,
      );
    }

    if (
      statistics.languages[0]
    ) {
      lines.push(
        `Top language: ${formatLanguageName(
          statistics.languages[0].name,
        )}`,
      );
    }

    return lines.join(
      "\n",
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
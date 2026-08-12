import * as vscode from "vscode";

import { ActivityTracker } from "../tracking/ActivityTracker";
import {
  DailyDimensionStats,
  DailyStats,
} from "../types/TrackerState";
import { CodingSession } from "../types/CodingSession";

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
            ? this.formatDuration(
                session.activeMilliseconds,
              )
            : "No active session",
        icon: "clock",
      },

      {
        kind: "stat",
        label: "Today",
        description:
          this.formatDuration(
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
          this.formatLanguageName(
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
          ): StatisticsNode => ({
            kind: "language",
            label:
              this.formatLanguageName(
                language,
              ),
            description:
              this.formatDuration(
                value.activeMilliseconds,
              ),
            icon: "code",
          }),
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
    const sessions =
      [...this.tracker.getSessions()]
        .slice(
          -5,
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

            return {
              kind: "session",
              label:
                project,
              description:
                this.formatDuration(
                  session.activeMilliseconds,
                ),
              tooltip:
                [
                  project,
                  state,
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
        ): StatisticsNode => ({
          kind,
          label: name,
          description:
            this.formatDuration(
              value.activeMilliseconds,
            ),
          icon,
        }),
      );
  }

  private formatLanguageName(
    languageId: string,
  ): string {
    const knownLanguages:
      Record<string, string> = {
      javascript:
        "JavaScript",

      javascriptreact:
        "JavaScript React",

      typescript:
        "TypeScript",

      typescriptreact:
        "TypeScript React",

      json:
        "JSON",

      jsonc:
        "JSON with Comments",

      markdown:
        "Markdown",

      html:
        "HTML",

      css:
        "CSS",

      scss:
        "SCSS",

      python:
        "Python",

      go:
        "Go",

      rust:
        "Rust",

      shellscript:
        "Shell Script",

      yaml:
        "YAML",
    };

    return (
      knownLanguages[languageId] ??
      languageId
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

  private formatDuration(
    milliseconds: number,
  ): string {
    const totalSeconds =
      Math.floor(
        milliseconds /
          1000,
      );

    const hours =
      Math.floor(
        totalSeconds /
          3600,
      );

    const minutes =
      Math.floor(
        (
          totalSeconds %
          3600
        ) /
          60,
      );

    const seconds =
      totalSeconds %
      60;

    if (hours > 0) {
      return [
        String(
          hours,
        ),

        String(
          minutes,
        ).padStart(
          2,
          "0",
        ),

        String(
          seconds,
        ).padStart(
          2,
          "0",
        ),
      ].join(
        ":",
      );
    }

    return [
      String(
        minutes,
      ),

      String(
        seconds,
      ).padStart(
        2,
        "0",
      ),
    ].join(
      ":",
    );
  }
}
import * as vscode from "vscode";

import { SessionHistoryService } from "../sessions/SessionHistoryService";

import {
  SessionHistoryGroup,
} from "../types/SessionHistoryTypes";

import { ActivityTracker } from "../tracking/ActivityTracker";

import { CodingSession } from "../types/CodingSession";

import {
  formatDuration,
} from "../utils/formatters";

const PERIODIC_REFRESH_INTERVAL_MS =
  30_000;

type SessionHistoryNodeKind =
  | "date"
  | "session"
  | "empty";

interface SessionHistoryNode {
  kind:
    SessionHistoryNodeKind;

  label: string;

  description?:
    string;

  tooltip?:
    string;

  icon?:
    string;

  children?:
    SessionHistoryNode[];
}

interface SessionHistorySnapshot {
  sessionCount:
    number;

  currentSessionId:
    | string
    | undefined;

  lastSessionId:
    | string
    | undefined;

  lastSessionEndedAt:
    | string
    | undefined;
}

export class SessionHistoryTreeProvider
  implements
    vscode.TreeDataProvider<SessionHistoryNode>,
    vscode.Disposable
{
  private readonly onDidChangeTreeDataEmitter =
    new vscode.EventEmitter<
      SessionHistoryNode |
      undefined |
      void
    >();

  public readonly onDidChangeTreeData =
    this.onDidChangeTreeDataEmitter.event;

  private readonly disposables:
    vscode.Disposable[] = [];

  private periodicRefreshTimer:
    NodeJS.Timeout | undefined;

  private lastSnapshot:
    SessionHistorySnapshot;

  constructor(
    private readonly tracker:
      ActivityTracker,

    private readonly historyService:
      SessionHistoryService,
  ) {
    this.lastSnapshot =
      this.createSnapshot();

    this.disposables.push(
      this.tracker.onDidUpdate(
        () => {
          this.handleTrackerUpdate();
        },
      ),
    );

    this.periodicRefreshTimer =
      setInterval(
        () => {
          this.refresh();
        },
        PERIODIC_REFRESH_INTERVAL_MS,
      );
  }

  public refresh(): void {
    this.lastSnapshot =
      this.createSnapshot();

    this.onDidChangeTreeDataEmitter.fire();
  }

  public getTreeItem(
    element:
      SessionHistoryNode,
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

    if (
      element.icon
    ) {
      item.iconPath =
        new vscode.ThemeIcon(
          element.icon,
        );
    }

    return item;
  }

  public getChildren(
    element?:
      SessionHistoryNode,
  ): SessionHistoryNode[] {
    if (
      element
    ) {
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

  private handleTrackerUpdate():
    void {
    const snapshot =
      this.createSnapshot();

    if (
      this.snapshotsEqual(
        this.lastSnapshot,
        snapshot,
      )
    ) {
      return;
    }

    this.lastSnapshot =
      snapshot;

    this.onDidChangeTreeDataEmitter.fire();
  }

  private createSnapshot():
    SessionHistorySnapshot {
    const sessions =
      this.tracker.getSessions();

    const currentSession =
      this.tracker.getCurrentSession();

    const lastSession =
      sessions.at(
        -1,
      );

    return {
      sessionCount:
        sessions.length,

      currentSessionId:
        currentSession?.id,

      lastSessionId:
        lastSession?.id,

      lastSessionEndedAt:
        lastSession?.endedAt,
    };
  }

  private snapshotsEqual(
    first:
      SessionHistorySnapshot,

    second:
      SessionHistorySnapshot,
  ): boolean {
    return (
      first.sessionCount ===
        second.sessionCount &&

      first.currentSessionId ===
        second.currentSessionId &&

      first.lastSessionId ===
        second.lastSessionId &&

      first.lastSessionEndedAt ===
        second.lastSessionEndedAt
    );
  }

  private getRootNodes():
    SessionHistoryNode[] {
    const groups =
      this.historyService.getGroups(
        this.tracker.getSessions(),
      );

    if (
      groups.length === 0
    ) {
      return [
        {
          kind: "empty",

          label:
            "No sessions recorded yet",

          tooltip:
            "Coding sessions will appear here once WaddleTracker records activity.",

          icon:
            "info",
        },
      ];
    }

    return groups.map(
      (group) =>
        this.createDateNode(
          group,
        ),
    );
  }

  private createDateNode(
    group:
      SessionHistoryGroup,
  ): SessionHistoryNode {
    const sessionCount =
      group.sessions.length;

    const sessionLabel =
      sessionCount === 1
        ? "1 session"
        : `${sessionCount} sessions`;

    return {
      kind: "date",

      label:
        this.formatDateLabel(
          group.date,
        ),

      description:
        `${sessionLabel} • ${formatDuration(
          group.activeMilliseconds,
        )}`,

      tooltip:
        [
          this.formatFullDate(
            group.date,
          ),

          sessionLabel,

          `Total active time: ${formatDuration(
            group.activeMilliseconds,
          )}`,
        ].join(
          "\n",
        ),

      icon:
        "calendar",

      children:
        group.sessions.map(
          (session) =>
            this.createSessionNode(
              session,
            ),
        ),
    };
  }

  private createSessionNode(
    session:
      CodingSession,
  ): SessionHistoryNode {
    const project =
      session.projectName ??
      "Unknown project";

    const duration =
      formatDuration(
        session.activeMilliseconds,
      );

    const active =
      !session.endedAt;

    const workspace =
      session.workspaceName ??
      "Unknown workspace";

    const environment =
      session.remoteName
        ? session.remoteName
        : "Local";

    const lines = [
      `Project: ${project}`,

      `Duration: ${duration}`,

      `Started: ${this.formatTimestamp(
        session.startedAt,
      )}`,

      active
        ? "Ended: Active"
        : `Ended: ${this.formatTimestamp(
            session.endedAt!,
          )}`,

      `Workspace: ${workspace}`,

      `Environment: ${environment}`,
    ];

    return {
      kind: "session",

      label:
        project,

      description:
        duration,

      tooltip:
        lines.join(
          "\n",
        ),

      icon:
        active
          ? "pulse"
          : "history",
    };
  }

  private formatDateLabel(
    date:
      string,
  ): string {
    const today =
      this.getLocalDateKey(
        new Date(),
      );

    const yesterday =
      this.shiftLocalDate(
        today,
        -1,
      );

    if (
      date === today
    ) {
      return "Today";
    }

    if (
      date === yesterday
    ) {
      return "Yesterday";
    }

    const value =
      this.parseLocalDate(
        date,
      );

    const options:
      Intl.DateTimeFormatOptions = {
      weekday:
        "short",

      month:
        "short",

      day:
        "numeric",
    };

    if (
      value.getFullYear() !==
      new Date().getFullYear()
    ) {
      options.year =
        "numeric";
    }

    return value.toLocaleDateString(
      undefined,
      options,
    );
  }

  private formatFullDate(
    date:
      string,
  ): string {
    return this.parseLocalDate(
      date,
    ).toLocaleDateString(
      undefined,
      {
        weekday:
          "long",

        year:
          "numeric",

        month:
          "long",

        day:
          "numeric",
      },
    );
  }

  private formatTimestamp(
    timestamp:
      string,
  ): string {
    return new Date(
      timestamp,
    ).toLocaleTimeString(
      undefined,
      {
        hour:
          "2-digit",

        minute:
          "2-digit",

        second:
          "2-digit",
      },
    );
  }

  private shiftLocalDate(
    date:
      string,

    days:
      number,
  ): string {
    const value =
      this.parseLocalDate(
        date,
      );

    value.setDate(
      value.getDate() +
        days,
    );

    return this.getLocalDateKey(
      value,
    );
  }

  private parseLocalDate(
    date:
      string,
  ): Date {
    const [
      year,
      month,
      day,
    ] =
      date
        .split("-")
        .map(
          Number,
        );

    return new Date(
      year,
      month - 1,
      day,
    );
  }

  private getLocalDateKey(
    date:
      Date,
  ): string {
    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1,
      ).padStart(
        2,
        "0",
      );

    const day =
      String(
        date.getDate(),
      ).padStart(
        2,
        "0",
      );

    return (
      `${year}-${month}-${day}`
    );
  }
}
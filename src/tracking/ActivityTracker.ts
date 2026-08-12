import * as vscode from "vscode";

import { StorageProvider } from "../storage/StorageProvider";

import {
  createEmptyDailyStats,
  DailyDimensionStats,
  DailyStats,
  TrackerState,
} from "../types/TrackerState";

import { ActivityContext } from "../types/ActivityContext";
import { CodingSession } from "../types/CodingSession";

import { ContextResolver } from "./ContextResolver";
import { SessionManager } from "./SessionManager";
import { TrackingFilter } from "./TrackingFilter";

const TICK_INTERVAL_MS =
  1_000;

const SAVE_INTERVAL_MS =
  30_000;

export class ActivityTracker
  implements vscode.Disposable
{
  private state:
    TrackerState;

  private lastActivityAt:
    number | undefined;

  private lastTickAt:
    number;

  private currentContext:
    ActivityContext;

  private tickTimer:
    NodeJS.Timeout | undefined;

  private saveTimer:
    NodeJS.Timeout | undefined;

  private dirty = false;
  private disposed = false;

  private readonly sessionManager:
    SessionManager;

  private readonly disposables:
    vscode.Disposable[] = [];

  private readonly onDidUpdateEmitter =
    new vscode.EventEmitter<void>();

  public readonly onDidUpdate =
    this.onDidUpdateEmitter.event;

  constructor(
    private readonly storage:
      StorageProvider,

    state:
      TrackerState,

    private readonly contextResolver:
      ContextResolver,

    private readonly trackingFilter =
      new TrackingFilter(),
  ) {
    this.state =
      state;

    this.lastTickAt =
      Date.now();

    this.currentContext =
      this.contextResolver.resolve();

    this.sessionManager =
      new SessionManager(
        this.state,
      );
  }

  public start(): void {
    this.registerActivityListeners();

    this.tickTimer =
      setInterval(
        () => {
          this.tick();
        },
        TICK_INTERVAL_MS,
      );

    this.saveTimer =
      setInterval(
        () => {
          void this.flush();
        },
        SAVE_INTERVAL_MS,
      );

    if (
      vscode.window.activeTextEditor
    ) {
      this.handleEditorActivity();
    }
  }

  public getTodayStats(): DailyStats {
    const date =
      this.getLocalDateKey();

    return (
      this.state.daily[date] ??
      createEmptyDailyStats(
        date,
      )
    );
  }

  public getDailyHistory():
    readonly DailyStats[] {
    return Object.values(
      this.state.daily,
    ).map(
      (day) => ({
        ...day,

        projects: {
          ...day.projects,
        },

        languages: {
          ...day.languages,
        },

        files: {
          ...day.files,
        },
      }),
    );
  }

  public getCurrentContext(): ActivityContext {
    return {
      ...this.currentContext,
    };
  }

  public getCurrentSession():
    CodingSession | undefined {
    return this.sessionManager
      .getCurrentSession();
  }

  public getSessions():
    readonly CodingSession[] {
    return this.sessionManager
      .getSessions();
  }

  public isActive(): boolean {
    if (
      this.isCurrentContextExcluded() ||
      this.lastActivityAt ===
        undefined
    ) {
      return false;
    }

    const idleTimeout =
      this.getIdleTimeoutMilliseconds();

    return (
      Date.now() -
        this.lastActivityAt <
      idleTimeout
    );
  }

  public isCurrentContextExcluded():
    boolean {
    return (
      !this.trackingFilter
        .shouldTrack(
          this.currentContext,
        )
    );
  }

  public async flush(): Promise<void> {
    if (
      !this.dirty
    ) {
      return;
    }

    await this.storage.saveState(
      this.state,
    );

    this.dirty =
      false;
  }

  public async disposeAsync():
    Promise<void> {
    if (
      this.disposed
    ) {
      return;
    }

    this.disposed =
      true;

    if (
      this.tickTimer
    ) {
      clearInterval(
        this.tickTimer,
      );
    }

    if (
      this.saveTimer
    ) {
      clearInterval(
        this.saveTimer,
      );
    }

    /*
     * Account for any active time between the
     * previous tick and extension shutdown.
     */
    this.tick();

    if (
      this.sessionManager
        .getCurrentSession()
    ) {
      const endedAt =
        this.getSessionEndTimestamp(
          Date.now(),
        );

      this.sessionManager
        .closeSession(
          endedAt,
        );

      this.dirty =
        true;
    }

    for (
      const disposable
      of this.disposables
    ) {
      disposable.dispose();
    }

    this.onDidUpdateEmitter.dispose();

    await this.flush();

    await this.storage.dispose();
  }

  public dispose(): void {
    void this.disposeAsync();
  }

  private registerActivityListeners():
    void {
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(
        () => {
          this.handleEditorActivity();
        },
      ),

      vscode.window.onDidChangeTextEditorSelection(
        () => {
          this.handleEditorActivity();
        },
      ),

      vscode.workspace.onDidChangeTextDocument(
        (event) => {
          if (
            vscode.window
              .activeTextEditor
              ?.document ===
            event.document
          ) {
            this.handleEditorActivity();
          }
        },
      ),

      vscode.workspace.onDidSaveTextDocument(
        (document) => {
          if (
            vscode.window
              .activeTextEditor
              ?.document ===
            document
          ) {
            this.handleEditorActivity();
          }
        },
      ),

      vscode.workspace.onDidOpenTextDocument(
        (document) => {
          if (
            vscode.window
              .activeTextEditor
              ?.document ===
            document
          ) {
            this.handleEditorActivity();
          }
        },
      ),

      vscode.workspace.onDidChangeWorkspaceFolders(
        () => {
          this.refreshContext();
        },
      ),

      vscode.workspace.onDidChangeConfiguration(
        (event) => {
          if (
            event.affectsConfiguration(
              "waddleTracker.tracking",
            )
          ) {
            this.handleTrackingConfigurationChange();
          }
        },
      ),
    );
  }

  private handleEditorActivity(): void {
    const now =
      Date.now();

    const nextContext =
      this.contextResolver.resolve();

    this.transitionContext(
      nextContext,
      now,
    );

    this.markActivity(
      now,
    );
  }

  private refreshContext(): void {
    const now =
      Date.now();

    const nextContext =
      this.contextResolver.resolve();

    this.transitionContext(
      nextContext,
      now,
    );

    if (
      this.isCurrentContextExcluded()
    ) {
      this.stopTrackingExcludedContext(
        now,
      );
    }

    this.onDidUpdateEmitter.fire();
  }

  private transitionContext(
    nextContext:
      ActivityContext,

    now:
      number,
  ): void {
    if (
      this.contextsEqual(
        this.currentContext,
        nextContext,
      )
    ) {
      return;
    }

    /*
     * Account for time up to the context switch
     * using the previous file/language/project.
     *
     * This also prevents time spent before an
     * excluded context was opened from being
     * attributed to that excluded context.
     */
    this.tickAt(
      now,
    );

    this.currentContext =
      nextContext;

    this.lastTickAt =
      now;
  }

  private markActivity(
    now = Date.now(),
  ): void {
    if (
      this.isCurrentContextExcluded()
    ) {
      this.stopTrackingExcludedContext(
        now,
      );

      this.onDidUpdateEmitter.fire();

      return;
    }

    const wasIdle =
      this.lastActivityAt ===
        undefined ||
      now -
        this.lastActivityAt >=
        this.getIdleTimeoutMilliseconds();

    if (
      wasIdle
    ) {
      /*
       * Finish accounting for the previous
       * active period before beginning a new
       * session.
       */
      if (
        this.lastActivityAt !==
        undefined
      ) {
        this.tickAt(
          now,
        );
      }

      this.lastTickAt =
        now;

      this.sessionManager
        .startSession(
          this.currentContext,
          now,
        );

      this.dirty =
        true;
    }

    this.lastActivityAt =
      now;

    this.sessionManager
      .markActivity(
        now,
      );

    this.onDidUpdateEmitter.fire();
  }

  private handleTrackingConfigurationChange():
    void {
    const now =
      Date.now();

    if (
      this.isCurrentContextExcluded()
    ) {
      this.stopTrackingExcludedContext(
        now,
      );
    }

    this.onDidUpdateEmitter.fire();
  }

  private stopTrackingExcludedContext(
    now:
      number,
  ): void {
    if (
      this.sessionManager
        .getCurrentSession()
    ) {
      this.sessionManager
        .closeSession(
          now,
        );

      this.dirty =
        true;
    }

    this.lastActivityAt =
      undefined;

    this.lastTickAt =
      now;
  }

  private tick(): void {
    this.tickAt(
      Date.now(),
    );
  }

  private tickAt(
    now: number,
  ): void {
    if (
      this.lastActivityAt ===
      undefined
    ) {
      this.lastTickAt =
        now;

      return;
    }

    if (
      this.isCurrentContextExcluded()
    ) {
      this.stopTrackingExcludedContext(
        now,
      );

      return;
    }

    const idleTimeout =
      this.getIdleTimeoutMilliseconds();

    const activityCutoff =
      this.lastActivityAt +
      idleTimeout;

    const activeUntil =
      Math.min(
        now,
        activityCutoff,
      );

    if (
      activeUntil >
      this.lastTickAt
    ) {
      const elapsed =
        activeUntil -
        this.lastTickAt;

      this.addActiveTime(
        elapsed,
        this.currentContext,
        activeUntil,
      );
    }

    if (
      now >=
        activityCutoff &&
      this.sessionManager
        .getCurrentSession()
    ) {
      this.sessionManager
        .closeSession(
          activityCutoff,
        );

      this.dirty =
        true;

      this.onDidUpdateEmitter.fire();
    }

    this.lastTickAt =
      now;
  }

  private addActiveTime(
    milliseconds: number,
    context: ActivityContext,
    activeUntil: number,
  ): void {
    if (
      milliseconds <= 0 ||
      !this.trackingFilter
        .shouldTrack(
          context,
        )
    ) {
      return;
    }

    const date =
      this.getLocalDateKey();

    const current =
      this.state.daily[date] ??
      createEmptyDailyStats(
        date,
      );

    current.activeMilliseconds +=
      milliseconds;

    if (
      context.projectName
    ) {
      this.incrementDimension(
        current.projects,
        context.projectName,
        milliseconds,
      );
    }

    if (
      context.languageId
    ) {
      this.incrementDimension(
        current.languages,
        context.languageId,
        milliseconds,
      );
    }

    if (
      context.filePath
    ) {
      this.incrementDimension(
        current.files,
        context.filePath,
        milliseconds,
      );
    }

    this.state.daily[date] =
      current;

    this.sessionManager
      .recordActiveTime(
        milliseconds,
        activeUntil,
        context,
      );

    this.dirty =
      true;

    this.onDidUpdateEmitter.fire();
  }

  private incrementDimension(
    collection: Record<
      string,
      DailyDimensionStats
    >,
    key: string,
    milliseconds: number,
  ): void {
    const current =
      collection[key] ?? {
        activeMilliseconds:
          0,
      };

    current.activeMilliseconds +=
      milliseconds;

    collection[key] =
      current;
  }

  private contextsEqual(
    first:
      ActivityContext,

    second:
      ActivityContext,
  ): boolean {
    return (
      first.workspaceName ===
        second.workspaceName &&
      first.workspaceUri ===
        second.workspaceUri &&
      first.projectName ===
        second.projectName &&
      first.fileName ===
        second.fileName &&
      first.filePath ===
        second.filePath &&
      first.languageId ===
        second.languageId &&
      first.remoteName ===
        second.remoteName
    );
  }

  private getSessionEndTimestamp(
    now: number,
  ): number {
    if (
      this.lastActivityAt ===
      undefined
    ) {
      return now;
    }

    return Math.min(
      now,
      this.lastActivityAt +
        this.getIdleTimeoutMilliseconds(),
    );
  }

  private getIdleTimeoutMilliseconds():
    number {
    const configuration =
      vscode.workspace.getConfiguration(
        "waddleTracker",
      );

    const minutes =
      configuration.get<number>(
        "idleTimeoutMinutes",
        5,
      );

    return (
      minutes *
      60 *
      1000
    );
  }

  private getLocalDateKey(): string {
    const now =
      new Date();

    const year =
      now.getFullYear();

    const month =
      String(
        now.getMonth() + 1,
      ).padStart(
        2,
        "0",
      );

    const day =
      String(
        now.getDate(),
      ).padStart(
        2,
        "0",
      );

    return (
      `${year}-${month}-${day}`
    );
  }
}

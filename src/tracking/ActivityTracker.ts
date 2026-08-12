import * as vscode from "vscode";

import { StorageProvider } from "../storage/StorageProvider";
import {
  DailyStats,
  TrackerState,
} from "../types/TrackerState";

const TICK_INTERVAL_MS = 1_000;
const SAVE_INTERVAL_MS = 30_000;

export class ActivityTracker implements vscode.Disposable {
  private state: TrackerState;

  private lastActivityAt: number | undefined;
  private lastTickAt: number;

  private tickTimer: NodeJS.Timeout | undefined;
  private saveTimer: NodeJS.Timeout | undefined;

  private dirty = false;
  private disposed = false;

  private readonly disposables: vscode.Disposable[] = [];
  private readonly onDidUpdateEmitter =
    new vscode.EventEmitter<void>();

  public readonly onDidUpdate =
    this.onDidUpdateEmitter.event;

  constructor(
    private readonly storage: StorageProvider,
    state: TrackerState,
  ) {
    this.state = state;
    this.lastTickAt = Date.now();
  }

  public start(): void {
    this.registerActivityListeners();

    this.tickTimer = setInterval(
      () => {
        this.tick();
      },
      TICK_INTERVAL_MS,
    );

    this.saveTimer = setInterval(
      () => {
        void this.flush();
      },
      SAVE_INTERVAL_MS,
    );

    if (vscode.window.activeTextEditor) {
      this.markActivity();
    }
  }

  public getTodayStats(): DailyStats {
    const date = this.getLocalDateKey();

    return (
      this.state.daily[date] ?? {
        date,
        activeMilliseconds: 0,
      }
    );
  }

  public isActive(): boolean {
    if (this.lastActivityAt === undefined) {
      return false;
    }

    const idleTimeout =
      this.getIdleTimeoutMilliseconds();

    return (
      Date.now() - this.lastActivityAt <
      idleTimeout
    );
  }

  public async flush(): Promise<void> {
    if (!this.dirty) {
      return;
    }

    await this.storage.saveState(
      this.state,
    );

    this.dirty = false;
  }

  public async disposeAsync(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    if (this.tickTimer) {
      clearInterval(this.tickTimer);
    }

    if (this.saveTimer) {
      clearInterval(this.saveTimer);
    }

    for (const disposable of this.disposables) {
      disposable.dispose();
    }

    this.onDidUpdateEmitter.dispose();

    await this.flush();
    await this.storage.dispose();
  }

  public dispose(): void {
    void this.disposeAsync();
  }

  private registerActivityListeners(): void {
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(
        () => {
          this.markActivity();
        },
      ),

      vscode.window.onDidChangeTextEditorSelection(
        () => {
          this.markActivity();
        },
      ),

      vscode.workspace.onDidChangeTextDocument(
        () => {
          this.markActivity();
        },
      ),

      vscode.workspace.onDidSaveTextDocument(
        () => {
          this.markActivity();
        },
      ),

      vscode.workspace.onDidOpenTextDocument(
        () => {
          this.markActivity();
        },
      ),
    );
  }

  private markActivity(): void {
    this.lastActivityAt = Date.now();
  }

  private tick(): void {
    const now = Date.now();

    if (this.lastActivityAt === undefined) {
      this.lastTickAt = now;
      return;
    }

    const idleTimeout =
      this.getIdleTimeoutMilliseconds();

    const activityCutoff =
      this.lastActivityAt + idleTimeout;

    const activeUntil = Math.min(
      now,
      activityCutoff,
    );

    if (activeUntil > this.lastTickAt) {
      const elapsed =
        activeUntil - this.lastTickAt;

      this.addActiveTime(
        elapsed,
      );
    }

    this.lastTickAt = now;
  }

  private addActiveTime(
    milliseconds: number,
  ): void {
    if (milliseconds <= 0) {
      return;
    }

    const date = this.getLocalDateKey();

    const current =
      this.state.daily[date] ?? {
        date,
        activeMilliseconds: 0,
      };

    current.activeMilliseconds +=
      milliseconds;

    this.state.daily[date] = current;

    this.dirty = true;

    this.onDidUpdateEmitter.fire();
  }

  private getIdleTimeoutMilliseconds(): number {
    const configuration =
      vscode.workspace.getConfiguration(
        "waddleTracker",
      );

    const minutes =
      configuration.get<number>(
        "idleTimeoutMinutes",
        5,
      );

    return minutes * 60 * 1000;
  }

  private getLocalDateKey(): string {
    const now = new Date();

    const year = now.getFullYear();

    const month = String(
      now.getMonth() + 1,
    ).padStart(
      2,
      "0",
    );

    const day = String(
      now.getDate(),
    ).padStart(
      2,
      "0",
    );

    return `${year}-${month}-${day}`;
  }
}
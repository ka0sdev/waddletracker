import {
  TrackerState,
} from "../types/TrackerState";

import {
  HttpSyncProvider,
} from "./HttpSyncProvider";

import {
  PendingSyncStore,
} from "./PendingSyncStore";

import {
  SyncConfiguration,
  SyncConfigurationService,
} from "./SyncConfigurationService";

import {
  SyncService,
} from "./SyncService";

import {
  SyncSnapshotService,
} from "./SyncSnapshotService";

export type AutoSyncState =
  | "idle"
  | "syncing"
  | "synced"
  | "pending"
  | "failed";

export interface AutoSyncResult {
  attempted:
    boolean;

  synchronized:
    boolean;

  pending:
    boolean;

  reason?:
    "disabled" |
    "automatic_sync_disabled" |
    "endpoint_not_configured" |
    "already_running" |
    "remote_failure" |
    "local_failure";
}

export interface AutoSyncStateSubscription {
  dispose():
    void;
}

export class AutoSyncService {
  private timer:
    NodeJS.Timeout |
    undefined;

  private running =
    false;

  private disposed =
    false;

  private state:
    AutoSyncState =
    "idle";

  private readonly stateListeners =
    new Set<
      (
        state:
          AutoSyncState,
      ) => void
    >();

  constructor(
    private readonly configurationService:
      SyncConfigurationService,

    private readonly pendingStore:
      PendingSyncStore,

    private readonly getTrackerState:
      () => Promise<TrackerState>,

    private readonly snapshotService =
      new SyncSnapshotService(),
  ) {}

  public getSyncState():
    AutoSyncState {
    return this.state;
  }

  public onDidChangeState(
    listener:
      (
        state:
          AutoSyncState,
      ) => void,
  ): AutoSyncStateSubscription {
    this.stateListeners.add(
      listener,
    );

    return {
      dispose:
        () => {
          this.stateListeners
            .delete(
              listener,
            );
        },
    };
  }

  public async initialize():
    Promise<void> {
    await this.pendingStore
      .initialize();

    await this.restart();

    const pending =
      await this.pendingStore
        .load();

    if (
      pending
    ) {
      this.setState(
        "pending",
      );

      void this.runOnce();
    }
  }

  public async restart():
    Promise<void> {
    this.stopTimer();

    if (
      this.disposed
    ) {
      return;
    }

    const configuration =
      await this.configurationService
        .getConfiguration();

    if (
      !this.shouldSchedule(
        configuration,
      )
    ) {
      return;
    }

    this.timer =
      setInterval(
        () => {
          void this.runOnce();
        },
        configuration
          .intervalMinutes *
          60_000,
      );
  }

  public async runOnce():
    Promise<AutoSyncResult> {
    if (
      this.running
    ) {
      return {
        attempted:
          false,

        synchronized:
          false,

        pending:
          this.state ===
            "pending",

        reason:
          "already_running",
      };
    }

    let configuration:
      SyncConfiguration;

    try {
      configuration =
        await this.configurationService
          .getConfiguration();
    } catch (
      error
    ) {
      this.setState(
        "failed",
      );

      console.error(
        "WaddleTracker could not read synchronization configuration.",
        error,
      );

      return {
        attempted:
          false,

        synchronized:
          false,

        pending:
          Boolean(
            await this.safeLoadPending(),
          ),

        reason:
          "local_failure",
      };
    }

    if (
      !configuration.enabled
    ) {
      this.setState(
        "idle",
      );

      return {
        attempted:
          false,

        synchronized:
          false,

        pending:
          Boolean(
            await this.safeLoadPending(),
          ),

        reason:
          "disabled",
      };
    }

    if (
      !configuration.autoSync
    ) {
      this.setState(
        "idle",
      );

      return {
        attempted:
          false,

        synchronized:
          false,

        pending:
          Boolean(
            await this.safeLoadPending(),
          ),

        reason:
          "automatic_sync_disabled",
      };
    }

    if (
      configuration.endpoint
        .length ===
      0
    ) {
      this.setState(
        "failed",
      );

      return {
        attempted:
          false,

        synchronized:
          false,

        pending:
          Boolean(
            await this.safeLoadPending(),
          ),

        reason:
          "endpoint_not_configured",
      };
    }

    this.running =
      true;

    this.setState(
      "syncing",
    );

    try {
      const state =
        await this.getTrackerState();

      const snapshot =
        this.snapshotService
          .createSnapshot(
            configuration.source,
            state,
          );

      let pending =
        await this.pendingStore
          .replace(
            snapshot,
          );

      const provider =
        new HttpSyncProvider({
          endpoint:
            configuration.endpoint,

          token:
            configuration.token,
        });

      const syncService =
        new SyncService(
          provider,
        );

      try {
        const result =
          await syncService
            .pushSnapshot(
              pending.snapshot,
            );

        if (
          !result.accepted
        ) {
          throw new Error(
            "The WaddleTracker server received the snapshot but did not accept it.",
          );
        }

        await this.pendingStore
          .clear();

        this.setState(
          "synced",
        );

        return {
          attempted:
            true,

          synchronized:
            true,

          pending:
            false,
        };
      } catch (
        error
      ) {
        pending =
          await this.pendingStore
            .recordFailure(
              pending,
              error,
            );

        this.setState(
          "pending",
        );

        console.warn(
          `WaddleTracker automatic sync failed. Snapshot remains cached locally for retry. ${pending.lastError ?? ""}`.trim(),
        );

        return {
          attempted:
            true,

          synchronized:
            false,

          pending:
            true,

          reason:
            "remote_failure",
        };
      }
    } catch (
      error
    ) {
      this.setState(
        "failed",
      );

      console.error(
        "WaddleTracker synchronization failed before the remote request could complete.",
        error,
      );

      return {
        attempted:
          false,

        synchronized:
          false,

        pending:
          Boolean(
            await this.safeLoadPending(),
          ),

        reason:
          "local_failure",
      };
    } finally {
      this.running =
        false;
    }
  }

  public async dispose():
    Promise<void> {
    this.disposed =
      true;

    this.stopTimer();

    this.stateListeners
      .clear();
  }

  private setState(
    state:
      AutoSyncState,
  ): void {
    if (
      this.state ===
      state
    ) {
      return;
    }

    this.state =
      state;

    for (
      const listener
      of this.stateListeners
    ) {
      listener(
        state,
      );
    }
  }

  private async safeLoadPending() {
    try {
      return await this.pendingStore
        .load();
    } catch {
      return undefined;
    }
  }

  private shouldSchedule(
    configuration:
      SyncConfiguration,
  ): boolean {
    return (
      configuration.enabled &&
      configuration.autoSync &&
      configuration.endpoint
        .length >
        0
    );
  }

  private stopTimer():
    void {
    if (
      !this.timer
    ) {
      return;
    }

    clearInterval(
      this.timer,
    );

    this.timer =
      undefined;
  }
}

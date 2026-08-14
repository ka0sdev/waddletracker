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
    "remote_failure";
}

export class AutoSyncService {
  private timer:
    NodeJS.Timeout |
    undefined;

  private running =
    false;

  private disposed =
    false;

  constructor(
    private readonly configurationService:
      SyncConfigurationService,

    private readonly pendingStore:
      PendingSyncStore,

    private readonly getState:
      () => Promise<TrackerState>,

    private readonly snapshotService =
      new SyncSnapshotService(),
  ) {}

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
          Boolean(
            await this.pendingStore
              .load(),
          ),

        reason:
          "already_running",
      };
    }

    const configuration =
      await this.configurationService
        .getConfiguration();

    if (
      !configuration.enabled
    ) {
      return {
        attempted:
          false,

        synchronized:
          false,

        pending:
          Boolean(
            await this.pendingStore
              .load(),
          ),

        reason:
          "disabled",
      };
    }

    if (
      !configuration.autoSync
    ) {
      return {
        attempted:
          false,

        synchronized:
          false,

        pending:
          Boolean(
            await this.pendingStore
              .load(),
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
      return {
        attempted:
          false,

        synchronized:
          false,

        pending:
          Boolean(
            await this.pendingStore
              .load(),
          ),

        reason:
          "endpoint_not_configured",
      };
    }

    this.running =
      true;

    try {
      const state =
        await this.getState();

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

import {
  TrackerState,
} from "../types/TrackerState";

import {
  SyncProvider,
  SyncPushResult,
  SyncSnapshot,
  SyncSource,
} from "./SyncTypes";

import {
  SyncSnapshotService,
} from "./SyncSnapshotService";

export class SyncService {
  constructor(
    private readonly provider:
      SyncProvider,

    private readonly snapshotService =
      new SyncSnapshotService(),
  ) {}

  public async pushState(
    source:
      SyncSource,

    state:
      TrackerState,
  ): Promise<SyncPushResult> {
    const snapshot =
      this.snapshotService
        .createSnapshot(
          source,
          state,
        );

    return this.pushSnapshot(
      snapshot,
    );
  }

  public async pushSnapshot(
    snapshot:
      SyncSnapshot,
  ): Promise<SyncPushResult> {
    const result =
      await this.provider
        .pushSnapshot(
          snapshot,
        );

    if (
      result.snapshotId !==
      snapshot.snapshotId
    ) {
      throw new Error(
        "Sync provider returned a mismatched snapshot id.",
      );
    }

    return result;
  }
}

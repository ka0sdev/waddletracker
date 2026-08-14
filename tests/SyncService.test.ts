import assert from "node:assert/strict";
import test from "node:test";

import {
  SyncProvider,
  SyncPushResult,
  SyncSnapshot,
} from "../src/sync/SyncTypes";

import {
  SyncService,
} from "../src/sync/SyncService";

import {
  createEmptyTrackerState,
} from "../src/types/TrackerState";

class RecordingSyncProvider
  implements SyncProvider
{
  public snapshot:
    SyncSnapshot |
    undefined;

  public async pushSnapshot(
    snapshot:
      SyncSnapshot,
  ): Promise<SyncPushResult> {
    this.snapshot =
      snapshot;

    return {
      accepted:
        true,

      snapshotId:
        snapshot.snapshotId,

      receivedAt:
        "2026-08-14T11:00:00.000Z",
    };
  }
}

class MismatchedSyncProvider
  implements SyncProvider
{
  public async pushSnapshot(
    _snapshot:
      SyncSnapshot,
  ): Promise<SyncPushResult> {
    return {
      accepted:
        true,

      snapshotId:
        "different-snapshot",

      receivedAt:
        "2026-08-14T11:00:00.000Z",
    };
  }
}

test(
  "SyncService pushes a snapshot through the configured provider",
  async () => {
    const provider =
      new RecordingSyncProvider();

    const service =
      new SyncService(
        provider,
      );

    const result =
      await service.pushState(
        {
          id:
            "desktop-main",

          name:
            "Main Desktop",

          platform:
            "win32",
        },
        createEmptyTrackerState(),
      );

    assert.equal(
      result.accepted,
      true,
    );

    assert.ok(
      provider.snapshot,
    );

    assert.equal(
      provider.snapshot.source.id,
      "desktop-main",
    );

    assert.equal(
      result.snapshotId,
      provider.snapshot.snapshotId,
    );
  },
);

test(
  "SyncService rejects provider responses for a different snapshot",
  async () => {
    const service =
      new SyncService(
        new MismatchedSyncProvider(),
      );

    await assert.rejects(
      service.pushState(
        {
          id:
            "desktop-main",

          name:
            "Main Desktop",

          platform:
            "win32",
        },
        createEmptyTrackerState(),
      ),
      /mismatched snapshot id/i,
    );
  },
);

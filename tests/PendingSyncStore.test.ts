import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";

import {
  PendingSyncStore,
} from "../src/sync/PendingSyncStore";

import {
  SyncSnapshot,
} from "../src/sync/SyncTypes";

function createSnapshot(
  snapshotId:
    string,
): SyncSnapshot {
  return {
    format:
      "waddletracker-sync",

    version:
      1,

    snapshotId,

    createdAt:
      "2026-08-14T16:00:00.000Z",

    source: {
      id:
        "source-1",

      name:
        "Desktop",

      platform:
        "win32",
    },

    state: {
      version:
        4,

      daily:
        {},

      sessions:
        [],
    },
  };
}

test(
  "PendingSyncStore persists only the newest pending snapshot",
  async () => {
    const directory =
      await fs.mkdtemp(
        path.join(
          os.tmpdir(),
          "waddletracker-pending-sync-",
        ),
      );

    try {
      const store =
        new PendingSyncStore(
          directory,
        );

      await store.initialize();

      await store.replace(
        createSnapshot(
          "0198aa5a-8b2f-7aa0-b019-5ae5706ac8d4",
        ),
      );

      await store.replace(
        createSnapshot(
          "0298aa5a-8b2f-7aa0-b019-5ae5706ac8d4",
        ),
      );

      const pending =
        await store.load();

      assert.equal(
        pending
          ?.snapshot
          .snapshotId,
        "0298aa5a-8b2f-7aa0-b019-5ae5706ac8d4",
      );

      assert.equal(
        pending?.attempts,
        0,
      );
    } finally {
      await fs.rm(
        directory,
        {
          recursive:
            true,

          force:
            true,
        },
      );
    }
  },
);

test(
  "PendingSyncStore records failures and can clear the pending snapshot",
  async () => {
    const directory =
      await fs.mkdtemp(
        path.join(
          os.tmpdir(),
          "waddletracker-pending-sync-",
        ),
      );

    try {
      const store =
        new PendingSyncStore(
          directory,
        );

      await store.initialize();

      const record =
        await store.replace(
          createSnapshot(
            "0198aa5a-8b2f-7aa0-b019-5ae5706ac8d4",
          ),
        );

      const failed =
        await store.recordFailure(
          record,
          new Error(
            "Network unavailable",
          ),
        );

      assert.equal(
        failed.attempts,
        1,
      );

      assert.equal(
        failed.lastError,
        "Network unavailable",
      );

      await store.clear();

      assert.equal(
        await store.load(),
        undefined,
      );
    } finally {
      await fs.rm(
        directory,
        {
          recursive:
            true,

          force:
            true,
        },
      );
    }
  },
);

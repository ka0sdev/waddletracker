import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";

import {
  SyncMetadataStore,
} from "../src/sync/SyncMetadataStore";

async function createDirectory():
  Promise<string> {
  return fs.mkdtemp(
    path.join(
      os.tmpdir(),
      "waddletracker-sync-metadata-",
    ),
  );
}

test(
  "SyncMetadataStore persists attempts, failures and successes",
  async () => {
    const directory =
      await createDirectory();

    try {
      const store =
        new SyncMetadataStore(
          directory,
        );

      await store.initialize();

      await store.recordAttempt(
        "2026-08-14T18:00:00.000Z",
      );

      await store.recordFailure(
        "transient",
        new Error(
          "Server unavailable",
        ),
        "2026-08-14T18:00:01.000Z",
      );

      let metadata =
        await store.load();

      assert.equal(
        metadata.lastAttemptAt,
        "2026-08-14T18:00:00.000Z",
      );

      assert.equal(
        metadata.lastFailureAt,
        "2026-08-14T18:00:01.000Z",
      );

      assert.equal(
        metadata.lastErrorKind,
        "transient",
      );

      assert.equal(
        metadata.lastError,
        "Server unavailable",
      );

      await store.recordSuccess(
        "2026-08-14T18:05:00.000Z",
      );

      metadata =
        await store.load();

      assert.equal(
        metadata.lastSuccessAt,
        "2026-08-14T18:05:00.000Z",
      );

      assert.equal(
        metadata.lastError,
        undefined,
      );

      assert.equal(
        metadata.lastErrorKind,
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

test(
  "SyncMetadataStore returns empty metadata when no history exists",
  async () => {
    const directory =
      await createDirectory();

    try {
      const store =
        new SyncMetadataStore(
          directory,
        );

      await store.initialize();

      assert.deepEqual(
        await store.load(),
        {},
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

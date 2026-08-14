import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";

import {
  JsonStorageProvider,
} from "../src/storage/JsonStorageProvider";

import {
  SQLiteStorageProvider,
} from "../src/storage/SQLiteStorageProvider";

import {
  StorageMigrationService,
} from "../src/storage/StorageMigrationService";

import {
  createEmptyTrackerState,
  TrackerState,
} from "../src/types/TrackerState";

async function createTemporaryDirectory():
  Promise<string> {
  return fs.mkdtemp(
    path.join(
      os.tmpdir(),
      "waddletracker-migration-test-",
    ),
  );
}

function createPopulatedState():
  TrackerState {
  return {
    version:
      4,

    daily: {
      "2026-08-14": {
        date:
          "2026-08-14",

        activeMilliseconds:
          180_000,

        projects: {
          waddletracker: {
            activeMilliseconds:
              180_000,
          },
        },

        languages: {
          typescript: {
            activeMilliseconds:
              150_000,
          },

          json: {
            activeMilliseconds:
              30_000,
          },
        },

        files: {
          "C:/Code/waddletracker/src/extension.ts": {
            activeMilliseconds:
              150_000,
          },

          "C:/Code/waddletracker/package.json": {
            activeMilliseconds:
              30_000,
          },
        },
      },
    },

    sessions: [
      {
        id:
          "session-1",

        startedAt:
          "2026-08-14T10:00:00.000Z",

        endedAt:
          "2026-08-14T10:03:00.000Z",

        lastActivityAt:
          "2026-08-14T10:03:00.000Z",

        activeMilliseconds:
          180_000,

        workspaceName:
          "WaddleTracker",

        projectName:
          "waddletracker",

        languages: {
          typescript: {
            activeMilliseconds:
              150_000,
          },

          json: {
            activeMilliseconds:
              30_000,
          },
        },

        files: {
          "C:/Code/waddletracker/src/extension.ts": {
            activeMilliseconds:
              150_000,
          },

          "C:/Code/waddletracker/package.json": {
            activeMilliseconds:
              30_000,
          },
        },
      },
    ],
  };
}

test(
  "StorageMigrationService migrates JSON state to SQLite and creates a backup",
  async () => {
    const directory =
      await createTemporaryDirectory();

    const jsonStorage =
      new JsonStorageProvider(
        directory,
      );

    try {
      await jsonStorage
        .initialize();

      const expected =
        createPopulatedState();

      await jsonStorage
        .saveState(
          expected,
        );

      await jsonStorage
        .dispose();

      const migration =
        new StorageMigrationService(
          directory,
        );

      const result =
        await migration
          .migrateJsonToSQLite();

      assert.equal(
        result.migrated,
        true,
      );

      assert.equal(
        result.reason,
        "migrated",
      );

      assert.ok(
        result.backupPath,
      );

      const backupContents =
        await fs.readFile(
          result.backupPath,
          "utf8",
        );

      const originalContents =
        await fs.readFile(
          path.join(
            directory,
            "waddletracker.json",
          ),
          "utf8",
        );

      assert.equal(
        backupContents,
        originalContents,
      );

      const sqliteStorage =
        new SQLiteStorageProvider(
          directory,
        );

      await sqliteStorage
        .initialize();

      const actual =
        await sqliteStorage
          .loadState();

      await sqliteStorage
        .dispose();

      assert.deepEqual(
        actual,
        expected,
      );
    } finally {
      await jsonStorage
        .dispose();

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
  "StorageMigrationService does nothing when no JSON state exists",
  async () => {
    const directory =
      await createTemporaryDirectory();

    try {
      const migration =
        new StorageMigrationService(
          directory,
        );

      const result =
        await migration
          .migrateJsonToSQLite();

      assert.deepEqual(
        result,
        {
          migrated:
            false,

          reason:
            "json-not-found",
        },
      );

      await assert.rejects(
        fs.access(
          path.join(
            directory,
            "waddletracker.sqlite3",
          ),
        ),
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
  "StorageMigrationService does not overwrite an existing SQLite database",
  async () => {
    const directory =
      await createTemporaryDirectory();

    const jsonStorage =
      new JsonStorageProvider(
        directory,
      );

    const sqliteStorage =
      new SQLiteStorageProvider(
        directory,
      );

    try {
      await jsonStorage
        .initialize();

      await jsonStorage
        .saveState(
          createPopulatedState(),
        );

      await sqliteStorage
        .initialize();

      const existingSQLiteState =
        createEmptyTrackerState();

      existingSQLiteState.daily[
        "2026-08-13"
      ] = {
        date:
          "2026-08-13",

        activeMilliseconds:
          42_000,

        projects:
          {},

        languages:
          {},

        files:
          {},
      };

      await sqliteStorage
        .saveState(
          existingSQLiteState,
        );

      await sqliteStorage
        .dispose();

      const migration =
        new StorageMigrationService(
          directory,
        );

      const result =
        await migration
          .migrateJsonToSQLite();

      assert.deepEqual(
        result,
        {
          migrated:
            false,

          reason:
            "sqlite-already-exists",
        },
      );

      const reloadedSQLite =
        new SQLiteStorageProvider(
          directory,
        );

      await reloadedSQLite
        .initialize();

      const actual =
        await reloadedSQLite
          .loadState();

      await reloadedSQLite
        .dispose();

      assert.deepEqual(
        actual,
        existingSQLiteState,
      );

      await assert.rejects(
        fs.access(
          path.join(
            directory,
            "waddletracker.json.backup",
          ),
        ),
      );
    } finally {
      await jsonStorage
        .dispose();

      await sqliteStorage
        .dispose();

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
  "StorageMigrationService preserves an empty JSON state",
  async () => {
    const directory =
      await createTemporaryDirectory();

    const jsonStorage =
      new JsonStorageProvider(
        directory,
      );

    try {
      await jsonStorage
        .initialize();

      await jsonStorage
        .saveState(
          createEmptyTrackerState(),
        );

      await jsonStorage
        .dispose();

      const migration =
        new StorageMigrationService(
          directory,
        );

      const result =
        await migration
          .migrateJsonToSQLite();

      assert.equal(
        result.migrated,
        true,
      );

      const sqliteStorage =
        new SQLiteStorageProvider(
          directory,
        );

      await sqliteStorage
        .initialize();

      const actual =
        await sqliteStorage
          .loadState();

      await sqliteStorage
        .dispose();

      assert.deepEqual(
        actual,
        createEmptyTrackerState(),
      );
    } finally {
      await jsonStorage
        .dispose();

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

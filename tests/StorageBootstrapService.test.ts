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
  StorageBootstrapService,
} from "../src/storage/StorageBootstrapService";

import {
  createEmptyTrackerState,
  TrackerState,
} from "../src/types/TrackerState";

async function createTemporaryDirectory():
  Promise<string> {
  return fs.mkdtemp(
    path.join(
      os.tmpdir(),
      "waddletracker-bootstrap-test-",
    ),
  );
}

function createState():
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
  "StorageBootstrapService migrates existing JSON and selects SQLite",
  async () => {
    const directory =
      await createTemporaryDirectory();

    const jsonStorage =
      new JsonStorageProvider(
        directory,
      );

    try {
      const expected =
        createState();

      await jsonStorage
        .initialize();

      await jsonStorage
        .saveState(
          expected,
        );

      await jsonStorage
        .dispose();

      const bootstrap =
        new StorageBootstrapService(
          directory,
        );

      const result =
        await bootstrap
          .initialize();

      try {
        assert.equal(
          result.provider,
          "sqlite",
        );

        assert.equal(
          result.migration?.reason,
          "migrated",
        );

        assert.equal(
          result.fallbackError,
          undefined,
        );

        assert.deepEqual(
          result.state,
          expected,
        );

        await fs.access(
          path.join(
            directory,
            "waddletracker.sqlite3",
          ),
        );

        await fs.access(
          path.join(
            directory,
            "waddletracker.json",
          ),
        );

        await fs.access(
          path.join(
            directory,
            "waddletracker.json.backup",
          ),
        );
      } finally {
        await result.storage
          .dispose();
      }
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
  "StorageBootstrapService creates a new empty SQLite database when no prior state exists",
  async () => {
    const directory =
      await createTemporaryDirectory();

    try {
      const bootstrap =
        new StorageBootstrapService(
          directory,
        );

      const result =
        await bootstrap
          .initialize();

      try {
        assert.equal(
          result.provider,
          "sqlite",
        );

        assert.equal(
          result.migration?.reason,
          "json-not-found",
        );

        assert.deepEqual(
          result.state,
          createEmptyTrackerState(),
        );

        await fs.access(
          path.join(
            directory,
            "waddletracker.sqlite3",
          ),
        );

        await assert.rejects(
          fs.access(
            path.join(
              directory,
              "waddletracker.json",
            ),
          ),
        );
      } finally {
        await result.storage
          .dispose();
      }
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
  "StorageBootstrapService reuses an existing SQLite database without importing JSON again",
  async () => {
    const directory =
      await createTemporaryDirectory();

    const sqliteStorage =
      new SQLiteStorageProvider(
        directory,
      );

    const jsonStorage =
      new JsonStorageProvider(
        directory,
      );

    try {
      const sqliteState =
        createState();

      await sqliteStorage
        .initialize();

      await sqliteStorage
        .saveState(
          sqliteState,
        );

      await sqliteStorage
        .dispose();

      await jsonStorage
        .initialize();

      const differentJsonState =
        createEmptyTrackerState();

      differentJsonState.daily[
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

      await jsonStorage
        .saveState(
          differentJsonState,
        );

      await jsonStorage
        .dispose();

      const bootstrap =
        new StorageBootstrapService(
          directory,
        );

      const result =
        await bootstrap
          .initialize();

      try {
        assert.equal(
          result.provider,
          "sqlite",
        );

        assert.equal(
          result.migration?.reason,
          "sqlite-already-exists",
        );

        assert.deepEqual(
          result.state,
          sqliteState,
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
        await result.storage
          .dispose();
      }
    } finally {
      await sqliteStorage
        .dispose();

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

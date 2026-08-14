import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";

import { JsonStorageProvider } from "../src/storage/JsonStorageProvider";
import { SQLiteStorageProvider } from "../src/storage/SQLiteStorageProvider";

import {
  createEmptyTrackerState,
  TrackerState,
} from "../src/types/TrackerState";

async function withStorage(
  callback:
    (
      directory:
        string,

      storage:
        SQLiteStorageProvider,
    ) => Promise<void>,
): Promise<void> {
  const directory =
    await fs.mkdtemp(
      path.join(
        os.tmpdir(),
        "waddletracker-sqlite-test-",
      ),
    );

  const storage =
    new SQLiteStorageProvider(
      directory,
    );

  try {
    await storage.initialize();

    await callback(
      directory,
      storage,
    );
  } finally {
    await storage.dispose();

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
}

function createPopulatedState():
  TrackerState {
  return {
    version:
      4,

    daily: {
      "2026-08-13": {
        date:
          "2026-08-13",

        activeMilliseconds:
          90_000,

        projects: {
          waddletracker: {
            activeMilliseconds:
              90_000,
          },
        },

        languages: {
          typescript: {
            activeMilliseconds:
              70_000,
          },

          json: {
            activeMilliseconds:
              20_000,
          },
        },

        files: {
          "C:/Code/waddletracker/src/extension.ts": {
            activeMilliseconds:
              70_000,
          },

          "C:/Code/waddletracker/package.json": {
            activeMilliseconds:
              20_000,
          },
        },
      },

      "2026-08-14": {
        date:
          "2026-08-14",

        activeMilliseconds:
          120_000,

        projects: {
          waddletracker: {
            activeMilliseconds:
              120_000,
          },
        },

        languages: {
          typescript: {
            activeMilliseconds:
              120_000,
          },
        },

        files: {
          "C:/Code/waddletracker/src/storage/SQLiteStorageProvider.ts": {
            activeMilliseconds:
              120_000,
          },
        },
      },
    },

    sessions: [
      {
        id:
          "session-older",

        startedAt:
          "2026-08-13T10:00:00.000Z",

        endedAt:
          "2026-08-13T10:01:30.000Z",

        lastActivityAt:
          "2026-08-13T10:01:30.000Z",

        activeMilliseconds:
          90_000,

        workspaceName:
          "WaddleTracker",

        projectName:
          "waddletracker",

        languages: {
          typescript: {
            activeMilliseconds:
              70_000,
          },

          json: {
            activeMilliseconds:
              20_000,
          },
        },

        files: {
          "C:/Code/waddletracker/src/extension.ts": {
            activeMilliseconds:
              70_000,
          },

          "C:/Code/waddletracker/package.json": {
            activeMilliseconds:
              20_000,
          },
        },
      },

      {
        id:
          "session-current",

        startedAt:
          "2026-08-14T10:00:00.000Z",

        lastActivityAt:
          "2026-08-14T10:02:00.000Z",

        activeMilliseconds:
          120_000,

        workspaceName:
          "WaddleTracker",

        projectName:
          "waddletracker",

        remoteName:
          "ssh-remote",

        languages: {
          typescript: {
            activeMilliseconds:
              120_000,
          },
        },

        files: {
          "C:/Code/waddletracker/src/storage/SQLiteStorageProvider.ts": {
            activeMilliseconds:
              120_000,
          },
        },
      },
    ],
  };
}

test(
  "SQLiteStorageProvider returns an empty v4 state for a new database",
  async () => {
    await withStorage(
      async (
        _directory,
        storage,
      ) => {
        const state =
          await storage.loadState();

        assert.deepEqual(
          state,
          createEmptyTrackerState(),
        );
      },
    );
  },
);

test(
  "SQLiteStorageProvider saves and reloads the complete v4 state",
  async () => {
    await withStorage(
      async (
        _directory,
        storage,
      ) => {
        const expected =
          createPopulatedState();

        await storage.saveState(
          expected,
        );

        const actual =
          await storage.loadState();

        assert.deepEqual(
          actual,
          expected,
        );
      },
    );
  },
);

test(
  "SQLiteStorageProvider replaces stale rows when a newer state is saved",
  async () => {
    await withStorage(
      async (
        _directory,
        storage,
      ) => {
        await storage.saveState(
          createPopulatedState(),
        );

        const replacement =
          createEmptyTrackerState();

        replacement.daily[
          "2026-08-14"
        ] = {
          date:
            "2026-08-14",

          activeMilliseconds:
            30_000,

          projects:
            {},

          languages: {
            markdown: {
              activeMilliseconds:
                30_000,
            },
          },

          files:
            {},
        };

        await storage.saveState(
          replacement,
        );

        const actual =
          await storage.loadState();

        assert.deepEqual(
          actual,
          replacement,
        );
      },
    );
  },
);

test(
  "SQLiteStorageProvider preserves JSON-loaded v4 state exactly",
  async () => {
    const directory =
      await fs.mkdtemp(
        path.join(
          os.tmpdir(),
          "waddletracker-json-sqlite-test-",
        ),
      );

    const jsonDirectory =
      path.join(
        directory,
        "json",
      );

    const sqliteDirectory =
      path.join(
        directory,
        "sqlite",
      );

    const jsonStorage =
      new JsonStorageProvider(
        jsonDirectory,
      );

    const sqliteStorage =
      new SQLiteStorageProvider(
        sqliteDirectory,
      );

    try {
      await jsonStorage.initialize();

      await sqliteStorage.initialize();

      const source =
        createPopulatedState();

      await jsonStorage.saveState(
        source,
      );

      const jsonState =
        await jsonStorage.loadState();

      await sqliteStorage.saveState(
        jsonState,
      );

      const sqliteState =
        await sqliteStorage.loadState();

      assert.deepEqual(
        sqliteState,
        jsonState,
      );
    } finally {
      await jsonStorage.dispose();

      await sqliteStorage.dispose();

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
  "SQLiteStorageProvider creates the SQLite database file",
  async () => {
    await withStorage(
      async (
        directory,
        _storage,
      ) => {
        const databaseFile =
          path.join(
            directory,
            "waddletracker.sqlite3",
          );

        const statistics =
          await fs.stat(
            databaseFile,
          );

        assert.equal(
          statistics.isFile(),
          true,
        );
      },
    );
  },
);

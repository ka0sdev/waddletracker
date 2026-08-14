import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";

import Database from "better-sqlite3";

import {
  SQLiteStorageProvider,
} from "../src/storage/SQLiteStorageProvider";

import {
  createEmptyTrackerState,
  TrackerState,
} from "../src/types/TrackerState";

async function createTemporaryDirectory():
  Promise<string> {
  return fs.mkdtemp(
    path.join(
      os.tmpdir(),
      "waddletracker-incremental-sqlite-test-",
    ),
  );
}

function createState():
  TrackerState {
  return {
    version:
      4,

    daily: {
      "2026-08-13": {
        date:
          "2026-08-13",

        activeMilliseconds:
          60_000,

        projects: {
          archive: {
            activeMilliseconds:
              60_000,
          },
        },

        languages: {
          typescript: {
            activeMilliseconds:
              60_000,
          },
        },

        files: {
          "C:/Code/archive.ts": {
            activeMilliseconds:
              60_000,
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
          "C:/Code/waddletracker/src/extension.ts": {
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
          "2026-08-13T10:01:00.000Z",

        lastActivityAt:
          "2026-08-13T10:01:00.000Z",

        activeMilliseconds:
          60_000,

        workspaceName:
          "Archive",

        projectName:
          "archive",

        languages: {
          typescript: {
            activeMilliseconds:
              60_000,
          },
        },

        files: {
          "C:/Code/archive.ts": {
            activeMilliseconds:
              60_000,
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

        languages: {
          typescript: {
            activeMilliseconds:
              120_000,
          },
        },

        files: {
          "C:/Code/waddletracker/src/extension.ts": {
            activeMilliseconds:
              120_000,
          },
        },
      },
    ],
  };
}

function installAuditTriggers(
  databaseFile:
    string,
): Database.Database {
  const database =
    new Database(
      databaseFile,
    );

  database.exec(
    `
      CREATE TABLE write_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        row_key TEXT NOT NULL,
        operation TEXT NOT NULL
      );

      CREATE TRIGGER audit_daily_stats_insert
      AFTER INSERT ON daily_stats
      BEGIN
        INSERT INTO write_audit (
          table_name,
          row_key,
          operation
        )
        VALUES (
          'daily_stats',
          NEW.date,
          'insert'
        );
      END;

      CREATE TRIGGER audit_daily_stats_update
      AFTER UPDATE ON daily_stats
      BEGIN
        INSERT INTO write_audit (
          table_name,
          row_key,
          operation
        )
        VALUES (
          'daily_stats',
          NEW.date,
          'update'
        );
      END;

      CREATE TRIGGER audit_daily_stats_delete
      AFTER DELETE ON daily_stats
      BEGIN
        INSERT INTO write_audit (
          table_name,
          row_key,
          operation
        )
        VALUES (
          'daily_stats',
          OLD.date,
          'delete'
        );
      END;

      CREATE TRIGGER audit_sessions_insert
      AFTER INSERT ON sessions
      BEGIN
        INSERT INTO write_audit (
          table_name,
          row_key,
          operation
        )
        VALUES (
          'sessions',
          NEW.id,
          'insert'
        );
      END;

      CREATE TRIGGER audit_sessions_update
      AFTER UPDATE ON sessions
      BEGIN
        INSERT INTO write_audit (
          table_name,
          row_key,
          operation
        )
        VALUES (
          'sessions',
          NEW.id,
          'update'
        );
      END;

      CREATE TRIGGER audit_sessions_delete
      AFTER DELETE ON sessions
      BEGIN
        INSERT INTO write_audit (
          table_name,
          row_key,
          operation
        )
        VALUES (
          'sessions',
          OLD.id,
          'delete'
        );
      END;
    `,
  );

  return database;
}

test(
  "SQLiteStorageProvider performs no database writes when state is unchanged",
  async () => {
    const directory =
      await createTemporaryDirectory();

    const storage =
      new SQLiteStorageProvider(
        directory,
      );

    let audit:
      Database.Database |
      undefined;

    try {
      await storage
        .initialize();

      const state =
        createState();

      await storage
        .saveState(
          state,
        );

      await storage
        .loadState();

      audit =
        installAuditTriggers(
          path.join(
            directory,
            "waddletracker.sqlite3",
          ),
        );

      await storage
        .saveState(
          state,
        );

      const count =
        audit.prepare(
          `
            SELECT COUNT(*) AS count
            FROM write_audit
          `,
        ).get() as {
          count:
            number;
        };

      assert.equal(
        count.count,
        0,
      );
    } finally {
      audit?.close();

      await storage
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
  "SQLiteStorageProvider writes only changed daily and session parent rows",
  async () => {
    const directory =
      await createTemporaryDirectory();

    const storage =
      new SQLiteStorageProvider(
        directory,
      );

    let audit:
      Database.Database |
      undefined;

    try {
      await storage
        .initialize();

      const state =
        createState();

      await storage
        .saveState(
          state,
        );

      await storage
        .loadState();

      audit =
        installAuditTriggers(
          path.join(
            directory,
            "waddletracker.sqlite3",
          ),
        );

      state.daily[
        "2026-08-14"
      ].activeMilliseconds +=
        30_000;

      state.daily[
        "2026-08-14"
      ].languages.typescript
        .activeMilliseconds +=
        30_000;

      state.sessions[
        1
      ].activeMilliseconds +=
        30_000;

      state.sessions[
        1
      ].lastActivityAt =
        "2026-08-14T10:02:30.000Z";

      state.sessions[
        1
      ].languages.typescript
        .activeMilliseconds +=
        30_000;

      await storage
        .saveState(
          state,
        );

      const writes =
        audit.prepare(
          `
            SELECT
              table_name,
              row_key,
              operation
            FROM write_audit
            ORDER BY id ASC
          `,
        ).all() as Array<{
          table_name:
            string;

          row_key:
            string;

          operation:
            string;
        }>;

      assert.deepEqual(
        writes,
        [
          {
            table_name:
              "daily_stats",

            row_key:
              "2026-08-14",

            operation:
              "update",
          },

          {
            table_name:
              "sessions",

            row_key:
              "session-current",

            operation:
              "update",
          },
        ],
      );

      const reloaded =
        await storage
          .loadState();

      assert.deepEqual(
        reloaded,
        state,
      );
    } finally {
      audit?.close();

      await storage
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
  "SQLiteStorageProvider removes state that no longer exists",
  async () => {
    const directory =
      await createTemporaryDirectory();

    const storage =
      new SQLiteStorageProvider(
        directory,
      );

    try {
      await storage
        .initialize();

      const state =
        createState();

      await storage
        .saveState(
          state,
        );

      delete state.daily[
        "2026-08-13"
      ];

      state.sessions =
        state.sessions.filter(
          (session) =>
            session.id !==
            "session-older",
        );

      await storage
        .saveState(
          state,
        );

      const reloaded =
        await storage
          .loadState();

      assert.deepEqual(
        reloaded,
        state,
      );

      assert.equal(
        reloaded.daily[
          "2026-08-13"
        ],
        undefined,
      );

      assert.equal(
        reloaded.sessions.some(
          (session) =>
            session.id ===
            "session-older",
        ),
        false,
      );
    } finally {
      await storage
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
  "SQLiteStorageProvider incremental persistence handles a full reset",
  async () => {
    const directory =
      await createTemporaryDirectory();

    const storage =
      new SQLiteStorageProvider(
        directory,
      );

    try {
      await storage
        .initialize();

      await storage
        .saveState(
          createState(),
        );

      const empty =
        createEmptyTrackerState();

      await storage
        .saveState(
          empty,
        );

      const reloaded =
        await storage
          .loadState();

      assert.deepEqual(
        reloaded,
        empty,
      );
    } finally {
      await storage
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

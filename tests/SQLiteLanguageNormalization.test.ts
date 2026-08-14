import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";

import {
  SQLiteStorageProvider,
} from "../src/storage/SQLiteStorageProvider";

import {
  TrackerState,
} from "../src/types/TrackerState";

async function createTemporaryDirectory():
  Promise<string> {
  return fs.mkdtemp(
    path.join(
      os.tmpdir(),
      "waddletracker-language-normalization-",
    ),
  );
}

test(
  "SQLiteStorageProvider merges historical language keys that differ only by case",
  async () => {
    const directory =
      await createTemporaryDirectory();

    const firstStorage =
      new SQLiteStorageProvider(
        directory,
      );

    try {
      await firstStorage
        .initialize();

      const state:
        TrackerState = {
        version:
          4,

        daily: {
          "2026-08-14": {
            date:
              "2026-08-14",

            activeMilliseconds:
              53_619,

            projects:
              {},

            languages: {
              Log: {
                activeMilliseconds:
                  46_269,
              },

              log: {
                activeMilliseconds:
                  7_350,
              },
            },

            files:
              {},
          },
        },

        sessions: [
          {
            id:
              "session-1",

            startedAt:
              "2026-08-14T10:00:00.000Z",

            endedAt:
              "2026-08-14T10:01:00.000Z",

            lastActivityAt:
              "2026-08-14T10:01:00.000Z",

            activeMilliseconds:
              53_619,

            languages: {
              Log: {
                activeMilliseconds:
                  46_269,
              },

              log: {
                activeMilliseconds:
                  7_350,
              },
            },

            files:
              {},
          },
        ],
      };

      await firstStorage
        .saveState(
          state,
        );

      await firstStorage
        .dispose();

      const secondStorage =
        new SQLiteStorageProvider(
          directory,
        );

      await secondStorage
        .initialize();

      const normalized =
        await secondStorage
          .loadState();

      await secondStorage
        .dispose();

      assert.deepEqual(
        normalized.daily[
          "2026-08-14"
        ].languages,
        {
          log: {
            activeMilliseconds:
              53_619,
          },
        },
      );

      assert.deepEqual(
        normalized.sessions[
          0
        ]?.languages,
        {
          log: {
            activeMilliseconds:
              53_619,
          },
        },
      );
    } finally {
      await firstStorage
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

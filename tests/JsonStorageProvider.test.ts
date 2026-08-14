import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";

import { JsonStorageProvider } from "../src/storage/JsonStorageProvider";

import {
  createEmptyTrackerState,
} from "../src/types/TrackerState";

async function withStorage(
  callback:
    (
      directory:
        string,

      storage:
        JsonStorageProvider,
    ) => Promise<void>,
): Promise<void> {
  const directory =
    await fs.mkdtemp(
      path.join(
        os.tmpdir(),
        "waddletracker-test-",
      ),
    );

  const storage =
    new JsonStorageProvider(
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

test(
  "JsonStorageProvider returns an empty v4 state when no state file exists",
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
  "JsonStorageProvider saves and reloads v4 state",
  async () => {
    await withStorage(
      async (
        _directory,
        storage,
      ) => {
        const state =
          createEmptyTrackerState();

        state.daily[
          "2026-08-14"
        ] = {
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

          files: {},
        };

        await storage.saveState(
          state,
        );

        const loaded =
          await storage.loadState();

        assert.deepEqual(
          loaded,
          state,
        );
      },
    );
  },
);

test(
  "JsonStorageProvider migrates v1 daily totals to v4",
  async () => {
    await withStorage(
      async (
        directory,
        storage,
      ) => {
        await fs.writeFile(
          path.join(
            directory,
            "waddletracker.json",
          ),
          JSON.stringify({
            version:
              1,

            daily: {
              "2026-08-14": {
                date:
                  "2026-08-14",

                activeMilliseconds:
                  90_000,
              },
            },
          }),
          "utf8",
        );

        const state =
          await storage.loadState();

        assert.equal(
          state.version,
          4,
        );

        assert.deepEqual(
          state.sessions,
          [],
        );

        assert.deepEqual(
          state.daily[
            "2026-08-14"
          ],
          {
            date:
              "2026-08-14",

            activeMilliseconds:
              90_000,

            projects: {},

            languages: {},

            files: {},
          },
        );
      },
    );
  },
);

test(
  "JsonStorageProvider migrates v3 sessions with empty language and file dimensions",
  async () => {
    await withStorage(
      async (
        directory,
        storage,
      ) => {
        await fs.writeFile(
          path.join(
            directory,
            "waddletracker.json",
          ),
          JSON.stringify({
            version:
              3,

            daily:
              {},

            sessions: [
              {
                id:
                  "legacy-session",

                startedAt:
                  "2026-08-14T10:00:00.000Z",

                endedAt:
                  "2026-08-14T10:30:00.000Z",

                lastActivityAt:
                  "2026-08-14T10:30:00.000Z",

                activeMilliseconds:
                  1_800_000,

                workspaceName:
                  "WaddleTracker",

                projectName:
                  "waddletracker",

                remoteName:
                  undefined,
              },
            ],
          }),
          "utf8",
        );

        const state =
          await storage.loadState();

        assert.equal(
          state.version,
          4,
        );

        assert.equal(
          state.sessions.length,
          1,
        );

        assert.deepEqual(
          state.sessions[0].languages,
          {},
        );

        assert.deepEqual(
          state.sessions[0].files,
          {},
        );
      },
    );
  },
);

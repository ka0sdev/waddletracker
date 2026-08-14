import assert from "node:assert/strict";
import test from "node:test";

import {
  SyncSnapshotService,
} from "../src/sync/SyncSnapshotService";

import {
  TrackerState,
} from "../src/types/TrackerState";

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
          "session-1",

        startedAt:
          "2026-08-14T10:00:00.000Z",

        endedAt:
          "2026-08-14T10:02:00.000Z",

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

test(
  "SyncSnapshotService creates a versioned detached snapshot",
  () => {
    const service =
      new SyncSnapshotService();

    const state =
      createState();

    const createdAt =
      new Date(
        "2026-08-14T10:30:00.000Z",
      );

    const snapshot =
      service.createSnapshot(
        {
          id:
            "desktop-main",

          name:
            "Main Desktop",

          platform:
            "win32",
        },
        state,
        createdAt,
      );

    assert.equal(
      snapshot.format,
      "waddletracker-sync",
    );

    assert.equal(
      snapshot.version,
      1,
    );

    assert.equal(
      snapshot.createdAt,
      "2026-08-14T10:30:00.000Z",
    );

    assert.equal(
      snapshot.source.id,
      "desktop-main",
    );

    assert.equal(
      snapshot.state.version,
      4,
    );

    assert.match(
      snapshot.snapshotId,
      /^[0-9a-f-]{36}$/i,
    );

    snapshot.state.daily[
      "2026-08-14"
    ].languages.typescript
      .activeMilliseconds =
      1;

    assert.equal(
      state.daily[
        "2026-08-14"
      ].languages.typescript
        .activeMilliseconds,
      120_000,
    );
  },
);

test(
  "SyncSnapshotService preserves optional source metadata",
  () => {
    const service =
      new SyncSnapshotService();

    const snapshot =
      service.createSnapshot(
        {
          id:
            "remote-devbox",

          name:
            "Devbox",

          platform:
            "linux",

          remoteName:
            "ssh-remote",
        },
        createState(),
      );

    assert.equal(
      snapshot.source.remoteName,
      "ssh-remote",
    );
  },
);

test(
  "SyncSnapshotService rejects empty source identifiers",
  () => {
    const service =
      new SyncSnapshotService();

    assert.throws(
      () =>
        service.createSnapshot(
          {
            id:
              "   ",

            name:
              "Main Desktop",

            platform:
              "win32",
          },
          createState(),
        ),
      /source id cannot be empty/i,
    );
  },
);

test(
  "SyncSnapshotService rejects unsupported tracker state versions",
  () => {
    const service =
      new SyncSnapshotService();

    const state:
      any =
      createState();

    state.version =
      3;

    assert.throws(
      () =>
        service.createSnapshot(
          {
            id:
              "desktop-main",

            name:
              "Main Desktop",

            platform:
              "win32",
          },
          state,
        ),
      /Unsupported TrackerState version/,
    );
  },
);

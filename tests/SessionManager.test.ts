import assert from "node:assert/strict";
import test from "node:test";

import { SessionManager } from "../src/tracking/SessionManager";

import {
  ActivityContext,
} from "../src/types/ActivityContext";

import {
  createEmptyTrackerState,
} from "../src/types/TrackerState";

function createContext(
  overrides:
    Partial<ActivityContext> = {},
): ActivityContext {
  return {
    workspaceName:
      "WaddleTracker",

    workspaceUri:
      "file:///workspace/waddletracker",

    projectName:
      "waddletracker",

    fileName:
      "ActivityTracker.ts",

    filePath:
      "/workspace/waddletracker/src/tracking/ActivityTracker.ts",

    languageId:
      "typescript",

    remoteName:
      undefined,

    ...overrides,
  };
}

test(
  "SessionManager records session totals and per-session dimensions",
  () => {
    const state =
      createEmptyTrackerState();

    const manager =
      new SessionManager(
        state,
      );

    const startedAt =
      Date.UTC(
        2026,
        7,
        14,
        10,
        0,
        0,
      );

    manager.startSession(
      createContext(),
      startedAt,
    );

    manager.recordActiveTime(
      30_000,
      startedAt + 30_000,
      createContext(),
    );

    manager.recordActiveTime(
      15_000,
      startedAt + 45_000,
      createContext({
        fileName:
          "package.json",

        filePath:
          "/workspace/waddletracker/package.json",

        languageId:
          "json",
      }),
    );

    const session =
      manager.getCurrentSession();

    assert.ok(
      session,
    );

    assert.equal(
      session.activeMilliseconds,
      45_000,
    );

    assert.deepEqual(
      session.languages,
      {
        typescript: {
          activeMilliseconds:
            30_000,
        },

        json: {
          activeMilliseconds:
            15_000,
        },
      },
    );

    assert.deepEqual(
      session.files,
      {
        "/workspace/waddletracker/src/tracking/ActivityTracker.ts": {
          activeMilliseconds:
            30_000,
        },

        "/workspace/waddletracker/package.json": {
          activeMilliseconds:
            15_000,
        },
      },
    );
  },
);

test(
  "SessionManager closes the current session at the supplied timestamp",
  () => {
    const state =
      createEmptyTrackerState();

    const manager =
      new SessionManager(
        state,
      );

    const startedAt =
      Date.UTC(
        2026,
        7,
        14,
        10,
        0,
        0,
      );

    manager.startSession(
      createContext(),
      startedAt,
    );

    manager.closeSession(
      startedAt + 60_000,
    );

    assert.equal(
      manager.getCurrentSession(),
      undefined,
    );

    assert.equal(
      state.sessions.length,
      1,
    );

    assert.equal(
      state.sessions[0].endedAt,
      new Date(
        startedAt + 60_000,
      ).toISOString(),
    );
  },
);

test(
  "SessionManager reset removes session history and current session",
  () => {
    const state =
      createEmptyTrackerState();

    const manager =
      new SessionManager(
        state,
      );

    manager.startSession(
      createContext(),
      Date.now(),
    );

    assert.equal(
      state.sessions.length,
      1,
    );

    manager.reset();

    assert.equal(
      state.sessions.length,
      0,
    );

    assert.equal(
      manager.getCurrentSession(),
      undefined,
    );
  },
);

test(
  "SessionManager recovers dangling persisted sessions as historical sessions",
  () => {
    const state =
      createEmptyTrackerState();

    state.sessions.push({
      id:
        "dangling-session",

      startedAt:
        "2026-08-14T10:00:00.000Z",

      endedAt:
        undefined,

      lastActivityAt:
        "2026-08-14T10:42:00.000Z",

      activeMilliseconds:
        42 * 60 * 1000,

      workspaceName:
        "WaddleTracker",

      projectName:
        "waddletracker",

      remoteName:
        undefined,

      languages: {
        typescript: {
          activeMilliseconds:
            42 * 60 * 1000,
        },
      },

      files: {},
    });

    const manager =
      new SessionManager(
        state,
      );

    assert.equal(
      manager.getCurrentSession(),
      undefined,
    );

    assert.equal(
      state.sessions[0].endedAt,
      "2026-08-14T10:42:00.000Z",
    );
  },
);

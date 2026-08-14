import assert from "node:assert/strict";
import test from "node:test";

import {
  ImportValidator,
} from "../src/data/ImportValidator";

function createValidExport() {
  return {
    format:
      "waddletracker-export",

    formatVersion:
      1,

    exportedAt:
      "2026-08-14T00:00:00.000Z",

    trackerState: {
      version:
        4,

      daily: {
        "2026-08-13": {
          date:
            "2026-08-13",

          activeMilliseconds:
            60_000,

          projects: {
            waddletracker: {
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

          files: {},
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
            "/workspace/src/index.ts": {
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
            undefined,

          lastActivityAt:
            "2026-08-14T10:02:00.000Z",

          activeMilliseconds:
            120_000,

          workspaceName:
            "WaddleTracker",

          projectName:
            "waddletracker",

          remoteName:
            undefined,

          languages: {
            typescript: {
              activeMilliseconds:
                120_000,
            },
          },

          files: {
            "/workspace/src/index.ts": {
              activeMilliseconds:
                120_000,
            },
          },
        },
      ],
    },
  };
}

test(
  "ImportValidator accepts a valid WaddleTracker v1 export",
  () => {
    const validator =
      new ImportValidator();

    const result =
      validator.validate(
        createValidExport(),
      );

    assert.equal(
      result.state.version,
      4,
    );

    assert.equal(
      result.summary.activeDays,
      2,
    );

    assert.equal(
      result.summary.sessions,
      1,
    );

    assert.equal(
      result.summary.activeMilliseconds,
      180_000,
    );
  },
);

test(
  "ImportValidator closes active imported sessions at last activity",
  () => {
    const validator =
      new ImportValidator();

    const result =
      validator.validate(
        createValidExport(),
      );

    assert.equal(
      result.state.sessions[0].endedAt,
      "2026-08-14T10:02:00.000Z",
    );
  },
);

test(
  "ImportValidator rejects an unsupported export format",
  () => {
    const validator =
      new ImportValidator();

    const value =
      createValidExport();

    value.format =
      "some-other-format";

    assert.throws(
      () =>
        validator.validate(
          value,
        ),
      /Unsupported or missing WaddleTracker export format/,
    );
  },
);

test(
  "ImportValidator rejects unsupported tracker-state versions",
  () => {
    const validator =
      new ImportValidator();

    const value:
      any =
      createValidExport();

    value.trackerState.version =
      3;

    assert.throws(
      () =>
        validator.validate(
          value,
        ),
      /Unsupported tracker-state version/,
    );
  },
);

test(
  "ImportValidator rejects negative activity durations",
  () => {
    const validator =
      new ImportValidator();

    const value =
      createValidExport();

    value.trackerState.daily[
      "2026-08-14"
    ].activeMilliseconds =
      -1;

    assert.throws(
      () =>
        validator.validate(
          value,
        ),
      /Expected a non-negative number/,
    );
  },
);

test(
  "ImportValidator rejects impossible calendar dates",
  () => {
    const validator =
      new ImportValidator();

    const value:
      any =
      createValidExport();

    value.trackerState.daily[
      "2026-02-31"
    ] = {
      ...value.trackerState.daily[
        "2026-08-14"
      ],

      date:
        "2026-02-31",
    };

    delete value.trackerState.daily[
      "2026-08-14"
    ];

    assert.throws(
      () =>
        validator.validate(
          value,
        ),
      /Invalid daily statistics date/,
    );
  },
);

test(
  "ImportValidator returns detached state data",
  () => {
    const validator =
      new ImportValidator();

    const original =
      createValidExport();

    const result =
      validator.validate(
        original,
      );

    result.state.daily[
      "2026-08-14"
    ].languages.typescript
      .activeMilliseconds =
      1;

    assert.equal(
      original.trackerState.daily[
        "2026-08-14"
      ].languages.typescript
        .activeMilliseconds,
      120_000,
    );
  },
);

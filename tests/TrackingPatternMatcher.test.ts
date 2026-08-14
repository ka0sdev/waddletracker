import assert from "node:assert/strict";
import test from "node:test";

import {
  TrackingPatternMatcher,
} from "../src/tracking/TrackingPatternMatcher";

test(
  "TrackingPatternMatcher matches exact values",
  () => {
    const matcher =
      new TrackingPatternMatcher();

    assert.equal(
      matcher.matchesGlob(
        "waddletracker",
        "waddletracker",
      ),
      true,
    );

    assert.equal(
      matcher.matchesGlob(
        "waddletracker",
        "reliomap",
      ),
      false,
    );
  },
);

test(
  "TrackingPatternMatcher supports single-star wildcards without crossing directories",
  () => {
    const matcher =
      new TrackingPatternMatcher();

    assert.equal(
      matcher.matchesGlob(
        "private-project",
        "private-*",
      ),
      true,
    );

    assert.equal(
      matcher.matchesGlob(
        "src/private/file.ts",
        "src/*",
      ),
      false,
    );
  },
);

test(
  "TrackingPatternMatcher supports recursive double-star directory patterns",
  () => {
    const matcher =
      new TrackingPatternMatcher();

    assert.equal(
      matcher.matchesGlob(
        "C:/Projects/waddletracker/src/private/file.ts",
        "C:/Projects/waddletracker/src/private/**",
      ),
      true,
    );

    assert.equal(
      matcher.matchesGlob(
        "src/private/nested/file.ts",
        "src/private/**",
      ),
      true,
    );
  },
);

test(
  "TrackingPatternMatcher supports recursive filename patterns",
  () => {
    const matcher =
      new TrackingPatternMatcher();

    assert.equal(
      matcher.matchesGlob(
        "C:/Projects/app/.env.local",
        "**/.env*",
      ),
      true,
    );

    assert.equal(
      matcher.matchesGlob(
        ".env",
        "**/.env*",
      ),
      true,
    );

    assert.equal(
      matcher.matchesGlob(
        "src/app.ts",
        "**/.env*",
      ),
      false,
    );
  },
);

test(
  "TrackingPatternMatcher normalizes Windows and Unix path separators",
  () => {
    const matcher =
      new TrackingPatternMatcher();

    const match =
      matcher.findMatchingPattern(
        "C:\\Projects\\app\\secrets\\token.key",
        [
          "C:/Projects/app/secrets/**",
        ],
        true,
      );

    assert.equal(
      match,
      "C:/Projects/app/secrets/**",
    );
  },
);

test(
  "TrackingPatternMatcher returns the original matching pattern",
  () => {
    const matcher =
      new TrackingPatternMatcher();

    const match =
      matcher.findMatchingPattern(
        "src/private/file.ts",
        [
          "",
          "src/public/**",
          "src/private/**",
        ],
        true,
      );

    assert.equal(
      match,
      "src/private/**",
    );
  },
);

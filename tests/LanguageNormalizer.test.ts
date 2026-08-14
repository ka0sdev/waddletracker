import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeLanguageId,
} from "../src/tracking/LanguageNormalizer";

test(
  "normalizeLanguageId lowercases language identifiers",
  () => {
    assert.equal(
      normalizeLanguageId(
        "Log",
      ),
      "log",
    );

    assert.equal(
      normalizeLanguageId(
        "TypeScript",
      ),
      "typescript",
    );
  },
);

test(
  "normalizeLanguageId trims surrounding whitespace",
  () => {
    assert.equal(
      normalizeLanguageId(
        "  Markdown  ",
      ),
      "markdown",
    );
  },
);

test(
  "normalizeLanguageId returns undefined for empty values",
  () => {
    assert.equal(
      normalizeLanguageId(
        undefined,
      ),
      undefined,
    );

    assert.equal(
      normalizeLanguageId(
        "   ",
      ),
      undefined,
    );
  },
);

export class TrackingPatternMatcher {
  public findMatchingPattern(
    value: string,
    patterns: readonly string[],
    normalizeAsPath = false,
  ): string | undefined {
    const candidate =
      normalizeAsPath
        ? this.normalizePath(
            value,
          )
        : value;

    for (
      const rawPattern
      of patterns
    ) {
      const trimmed =
        rawPattern.trim();

      if (
        trimmed.length === 0
      ) {
        continue;
      }

      const pattern =
        normalizeAsPath
          ? this.normalizePath(
              trimmed,
            )
          : trimmed;

      if (
        this.matchesGlob(
          candidate,
          pattern,
        )
      ) {
        return rawPattern;
      }
    }

    return undefined;
  }

  public matchesGlob(
    value: string,
    pattern: string,
  ): boolean {
    const expression =
      this.globToRegularExpression(
        pattern,
      );

    const flags =
      process.platform ===
      "win32"
        ? "i"
        : "";

    return new RegExp(
      expression,
      flags,
    ).test(
      value,
    );
  }

  public normalizePath(
    value: string,
  ): string {
    return value
      .replace(
        /\\/g,
        "/",
      )
      .replace(
        /^\.\/+/,
        "",
      )
      .replace(
        /\/+/g,
        "/",
      );
  }

  private globToRegularExpression(
    pattern: string,
  ): string {
    let expression =
      "^";

    for (
      let index = 0;
      index < pattern.length;
      index += 1
    ) {
      const character =
        pattern[index];

      if (
        character === "*"
      ) {
        const nextCharacter =
          pattern[
            index + 1
          ];

        if (
          nextCharacter === "*"
        ) {
          const characterAfterGlob =
            pattern[
              index + 2
            ];

          if (
            characterAfterGlob === "/"
          ) {
            expression +=
              "(?:.*/)?";

            index += 2;
          } else {
            expression +=
              ".*";

            index += 1;
          }
        } else {
          expression +=
            "[^/]*";
        }

        continue;
      }

      if (
        character === "?"
      ) {
        expression +=
          "[^/]";

        continue;
      }

      if (
        "\\.^$+{}()|[]"
          .includes(
            character,
          )
      ) {
        expression +=
          `\\${character}`;

        continue;
      }

      expression +=
        character;
    }

    expression +=
      "$";

    return expression;
  }
}

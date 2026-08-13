import * as vscode from "vscode";

import { ActivityContext } from "../types/ActivityContext";

export type TrackingExclusionKind =
  | "project"
  | "file"
  | "language";

export interface TrackingExclusion {
  kind: TrackingExclusionKind;
  value: string;
  pattern: string;
}

export class TrackingFilter {
  public getExclusion(
    context: ActivityContext,
  ): TrackingExclusion | undefined {
    const configuration =
      vscode.workspace.getConfiguration(
        "waddleTracker",
      );

    const excludedProjects =
      configuration.get<string[]>(
        "tracking.excludedProjects",
        [],
      );

    const excludedLanguages =
      configuration.get<string[]>(
        "tracking.excludedLanguages",
        [],
      );

    if (
      context.projectName
    ) {
      const pattern =
        this.findMatchingPattern(
          context.projectName,
          excludedProjects,
        );

      if (
        pattern
      ) {
        return {
          kind:
            "project",

          value:
            context.projectName,

          pattern,
        };
      }
    }

    const fileExclusion =
      this.getFileExclusion(
        context.filePath,
        context.fileName,
      );

    if (
      fileExclusion
    ) {
      return fileExclusion;
    }

    if (
      context.languageId
    ) {
      const pattern =
        this.findMatchingPattern(
          context.languageId,
          excludedLanguages,
        );

      if (
        pattern
      ) {
        return {
          kind:
            "language",

          value:
            context.languageId,

          pattern,
        };
      }
    }

    return undefined;
  }

  public getFileExclusion(
    filePath:
      string |
      undefined,

    fileName?:
      string |
      undefined,
  ): TrackingExclusion | undefined {
    if (
      !filePath &&
      !fileName
    ) {
      return undefined;
    }

    const configuration =
      vscode.workspace.getConfiguration(
        "waddleTracker",
      );

    const excludedFiles =
      configuration.get<string[]>(
        "tracking.excludedFiles",
        [],
      );

    const candidates =
      [
        filePath,
        fileName,
      ].filter(
        (
          value,
        ): value is string =>
          Boolean(
            value,
          ),
      );

    for (
      const candidate
      of candidates
    ) {
      const normalizedCandidate =
        this.normalizePath(
          candidate,
        );

      const pattern =
        this.findMatchingPattern(
          normalizedCandidate,
          excludedFiles,
          true,
        );

      if (
        pattern
      ) {
        return {
          kind:
            "file",

          value:
            candidate,

          pattern,
        };
      }
    }

    return undefined;
  }

  public shouldTrack(
    context: ActivityContext,
  ): boolean {
    return (
      this.getExclusion(
        context,
      ) === undefined
    );
  }

  private findMatchingPattern(
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

  private matchesGlob(
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

  private normalizePath(
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
}

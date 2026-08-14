import * as vscode from "vscode";

import { ActivityContext } from "../types/ActivityContext";

import {
  TrackingPatternMatcher,
} from "./TrackingPatternMatcher";

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
  constructor(
    private readonly matcher =
      new TrackingPatternMatcher(),
  ) {}

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
        this.matcher
          .findMatchingPattern(
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
        this.matcher
          .findMatchingPattern(
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
      const pattern =
        this.matcher
          .findMatchingPattern(
            candidate,
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
}

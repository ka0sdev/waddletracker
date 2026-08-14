import * as vscode from "vscode";

import {
  ImportSummary,
  ImportValidator,
} from "./ImportValidator";

import {
  TrackerState,
} from "../types/TrackerState";

export interface ImportSelection {
  state:
    TrackerState;

  summary:
    ImportSummary;
}

export class ImportService {
  constructor(
    private readonly validator =
      new ImportValidator(),
  ) {}

  public async selectImport():
    Promise<
      ImportSelection |
      undefined
    > {
    const selected =
      await vscode.window
        .showOpenDialog({
          canSelectFiles:
            true,

          canSelectFolders:
            false,

          canSelectMany:
            false,

          filters: {
            "WaddleTracker Export": [
              "json",
            ],
          },

          openLabel:
            "Import WaddleTracker Statistics",

          title:
            "Import WaddleTracker Statistics",
        });

    const source =
      selected?.at(
        0,
      );

    if (
      !source
    ) {
      return undefined;
    }

    const content =
      await vscode.workspace.fs
        .readFile(
          source,
        );

    let parsed:
      unknown;

    try {
      parsed =
        JSON.parse(
          Buffer.from(
            content,
          ).toString(
            "utf8",
          ),
        );
    } catch {
      throw new Error(
        "The selected file is not valid JSON.",
      );
    }

    return this.validator
      .validate(
        parsed,
      );
  }
}

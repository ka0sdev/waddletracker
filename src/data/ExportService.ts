import * as vscode from "vscode";

import { TrackerState } from "../types/TrackerState";

const EXPORT_FORMAT =
  "waddletracker-export";

const EXPORT_FORMAT_VERSION =
  1;

interface WaddleTrackerExport {
  format:
    typeof EXPORT_FORMAT;

  formatVersion:
    typeof EXPORT_FORMAT_VERSION;

  exportedAt:
    string;

  trackerState:
    TrackerState;
}

export class ExportService {
  constructor(
    private readonly getTrackerState:
      () => Promise<TrackerState>,
  ) {}

  public async exportStatistics():
    Promise<boolean> {
    const trackerState =
      await this.getTrackerState();

    const exportData:
      WaddleTrackerExport = {
      format:
        EXPORT_FORMAT,

      formatVersion:
        EXPORT_FORMAT_VERSION,

      exportedAt:
        new Date()
          .toISOString(),

      trackerState,
    };

    const target =
      await vscode.window
        .showSaveDialog({
          defaultUri:
            this.getDefaultExportUri(),

          filters: {
            "WaddleTracker Export": [
              "json",
            ],
          },

          saveLabel:
            "Export WaddleTracker Statistics",

          title:
            "Export WaddleTracker Statistics",
        });

    if (
      !target
    ) {
      return false;
    }

    const content =
      JSON.stringify(
        exportData,
        null,
        2,
      );

    await vscode.workspace.fs
      .writeFile(
        target,
        Buffer.from(
          content,
          "utf8",
        ),
      );

    return true;
  }

  private getDefaultExportUri():
    vscode.Uri {
    const fileName =
      `waddletracker-export-${this.getLocalDateKey()}.json`;

    const workspaceFolder =
      vscode.workspace
        .workspaceFolders
        ?.at(
          0,
        );

    if (
      workspaceFolder
    ) {
      return vscode.Uri.joinPath(
        workspaceFolder.uri,
        fileName,
      );
    }

    return vscode.Uri.file(
      fileName,
    );
  }

  private getLocalDateKey():
    string {
    const now =
      new Date();

    const year =
      now.getFullYear();

    const month =
      String(
        now.getMonth() + 1,
      ).padStart(
        2,
        "0",
      );

    const day =
      String(
        now.getDate(),
      ).padStart(
        2,
        "0",
      );

    return (
      `${year}-${month}-${day}`
    );
  }
}

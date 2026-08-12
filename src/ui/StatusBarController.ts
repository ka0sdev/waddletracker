import * as vscode from "vscode";

import { ActivityTracker } from "../tracking/ActivityTracker";

export class StatusBarController
  implements vscode.Disposable
{
  private readonly item:
    vscode.StatusBarItem;

  private readonly disposables:
    vscode.Disposable[] = [];

  constructor(
    private readonly tracker:
      ActivityTracker,
  ) {
    this.item =
      vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100,
      );

    this.item.command =
      "waddletracker.showStatus";

    this.item.tooltip =
      "WaddleTracker — today's coding activity";

    this.disposables.push(
      this.tracker.onDidUpdate(
        () => {
          this.update();
        },
      ),

      vscode.workspace.onDidChangeConfiguration(
        (event) => {
          if (
            event.affectsConfiguration(
              "waddleTracker.statusBar",
            )
          ) {
            this.update();
          }
        },
      ),
    );

    this.update();
  }

  public update(): void {
    const configuration =
      vscode.workspace.getConfiguration(
        "waddleTracker",
      );

    const enabled =
      configuration.get<boolean>(
        "statusBar.enabled",
        true,
      );

    if (!enabled) {
      this.item.hide();
      return;
    }

    const stats =
      this.tracker.getTodayStats();

    const formatted =
      this.formatDuration(
        stats.activeMilliseconds,
      );

    this.item.text =
      `$(clock) ${formatted}`;

    this.item.show();
  }

  public dispose(): void {
    for (
      const disposable
      of this.disposables
    ) {
      disposable.dispose();
    }

    this.item.dispose();
  }

  private formatDuration(
    milliseconds: number,
  ): string {
    const totalSeconds = Math.floor(
      milliseconds / 1000,
    );

    const hours = Math.floor(
      totalSeconds / 3600,
    );

    const minutes = Math.floor(
      (totalSeconds % 3600) / 60,
    );

    const seconds =
      totalSeconds % 60;

    if (hours > 0) {
      return [
        String(hours),
        String(minutes).padStart(
          2,
          "0",
        ),
        String(seconds).padStart(
          2,
          "0",
        ),
      ].join(":");
    }

    return [
      String(minutes),
      String(seconds).padStart(
        2,
        "0",
      ),
    ].join(":");
  }
}
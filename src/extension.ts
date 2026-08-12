import * as vscode from "vscode";

import { JsonStorageProvider } from "./storage/JsonStorageProvider";
import { ActivityTracker } from "./tracking/ActivityTracker";
import { StatusBarController } from "./ui/StatusBarController";

let activityTracker:
  ActivityTracker | undefined;

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const storage =
    new JsonStorageProvider(
      context.globalStorageUri.fsPath,
    );

  await storage.initialize();

  const state =
    await storage.loadState();

  activityTracker =
    new ActivityTracker(
      storage,
      state,
    );

  const statusBar =
    new StatusBarController(
      activityTracker,
    );

  const showStatusCommand =
    vscode.commands.registerCommand(
      "waddletracker.showStatus",
      async () => {
        if (!activityTracker) {
          return;
        }

        const stats =
          activityTracker.getTodayStats();

        const duration =
          formatDuration(
            stats.activeMilliseconds,
          );

        const activityState =
          activityTracker.isActive()
            ? "Active"
            : "Idle";

        await vscode.window.showInformationMessage(
          [
            "WaddleTracker",
            `Today: ${duration}`,
            `Status: ${activityState}`,
          ].join(" • "),
        );
      },
    );

  context.subscriptions.push(
    activityTracker,
    statusBar,
    showStatusCommand,
  );

  activityTracker.start();

  console.log(
    "WaddleTracker activated.",
  );
}

export async function deactivate(): Promise<void> {
  if (!activityTracker) {
    return;
  }

  await activityTracker.disposeAsync();

  activityTracker = undefined;
}

function formatDuration(
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

  return [
    String(hours).padStart(
      2,
      "0",
    ),
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
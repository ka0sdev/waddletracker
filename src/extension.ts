import * as vscode from "vscode";

import { JsonStorageProvider } from "./storage/JsonStorageProvider";

import { ActivityTracker } from "./tracking/ActivityTracker";
import { ContextResolver } from "./tracking/ContextResolver";

import { StatisticsTreeProvider } from "./ui/StatisticsTreeProvider";
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

  const contextResolver =
    new ContextResolver();

  activityTracker =
    new ActivityTracker(
      storage,
      state,
      contextResolver,
    );

  const statusBar =
    new StatusBarController(
      activityTracker,
    );

  const statisticsProvider =
    new StatisticsTreeProvider(
      activityTracker,
    );

  const statisticsView =
    vscode.window.createTreeView(
      "waddletracker.statistics",
      {
        treeDataProvider:
          statisticsProvider,

        showCollapseAll:
          true,
      },
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

        const currentContext =
          activityTracker.getCurrentContext();

        const currentSession =
          activityTracker.getCurrentSession();

        const duration =
          formatDuration(
            stats.activeMilliseconds,
          );

        const activityState =
          activityTracker.isActive()
            ? "Active"
            : "Idle";

        const details = [
          "WaddleTracker",
          `Today: ${duration}`,
          `Status: ${activityState}`,
        ];

        if (currentSession) {
          details.push(
            `Session: ${formatDuration(
              currentSession.activeMilliseconds,
            )}`,
          );
        }

        if (
          currentContext.projectName
        ) {
          details.push(
            `Project: ${currentContext.projectName}`,
          );
        }

        if (
          currentContext.languageId
        ) {
          details.push(
            `Language: ${currentContext.languageId}`,
          );
        }

        await vscode.window.showInformationMessage(
          details.join(
            " • ",
          ),
        );
      },
    );

  const openSettingsCommand =
    vscode.commands.registerCommand(
      "waddletracker.openSettings",
      async () => {
        await vscode.commands.executeCommand(
          "workbench.action.openSettings",
          "@ext:ka0sdev.waddletracker",
        );
      },
    );

  const refreshStatisticsCommand =
    vscode.commands.registerCommand(
      "waddletracker.refreshStatistics",
      () => {
        statisticsProvider.refresh();
      },
    );

  context.subscriptions.push(
    activityTracker,
    statusBar,
    statisticsProvider,
    statisticsView,
    showStatusCommand,
    openSettingsCommand,
    refreshStatisticsCommand,
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

  activityTracker =
    undefined;
}

function formatDuration(
  milliseconds: number,
): string {
  const totalSeconds =
    Math.floor(
      milliseconds /
        1000,
    );

  const hours =
    Math.floor(
      totalSeconds /
        3600,
    );

  const minutes =
    Math.floor(
      (
        totalSeconds %
        3600
      ) /
        60,
    );

  const seconds =
    totalSeconds %
    60;

  return [
    String(
      hours,
    ).padStart(
      2,
      "0",
    ),

    String(
      minutes,
    ).padStart(
      2,
      "0",
    ),

    String(
      seconds,
    ).padStart(
      2,
      "0",
    ),
  ].join(
    ":",
  );
}
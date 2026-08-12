import * as vscode from "vscode";

import { SessionHistoryService } from "./sessions/SessionHistoryService";

import { JsonStorageProvider } from "./storage/JsonStorageProvider";

import { StatisticsService } from "./statistics/StatisticsService";

import { ActivityTracker } from "./tracking/ActivityTracker";
import { ContextResolver } from "./tracking/ContextResolver";

import { CurrentActivityProvider } from "./ui/CurrentActivityProvider";
import { SessionHistoryTreeProvider } from "./ui/SessionHistoryTreeProvider";
import { StatisticsDashboardProvider } from "./ui/StatisticsDashboardProvider";
import { StatusBarController } from "./ui/StatusBarController";

import {
  formatDurationClock,
} from "./utils/formatters";

let activityTracker:
  ActivityTracker | undefined;

export async function activate(
  context:
    vscode.ExtensionContext,
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

  const statisticsService =
    new StatisticsService();

  const sessionHistoryService =
    new SessionHistoryService();

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

  const currentActivityProvider =
    new CurrentActivityProvider(
      activityTracker,
    );

  const currentActivityRegistration =
    vscode.window
      .registerWebviewViewProvider(
        CurrentActivityProvider
          .viewType,

        currentActivityProvider,
      );

  const sessionHistoryProvider =
    new SessionHistoryTreeProvider(
      activityTracker,
      sessionHistoryService,
    );

  const sessionHistoryView =
    vscode.window.createTreeView(
      "waddletracker.sessionHistory",
      {
        treeDataProvider:
          sessionHistoryProvider,

        showCollapseAll:
          true,
      },
    );

  const dashboardProvider =
    new StatisticsDashboardProvider(
      activityTracker,
      statisticsService,
    );

  const dashboardRegistration =
    vscode.window
      .registerWebviewViewProvider(
        StatisticsDashboardProvider
          .viewType,

        dashboardProvider,
      );

  const showStatusCommand =
    vscode.commands.registerCommand(
      "waddletracker.showStatus",
      async () => {
        if (
          !activityTracker
        ) {
          return;
        }

        const stats =
          activityTracker.getTodayStats();

        const currentContext =
          activityTracker.getCurrentContext();

        const currentSession =
          activityTracker.getCurrentSession();

        const duration =
          formatDurationClock(
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

        if (
          currentSession
        ) {
          details.push(
            `Session: ${formatDurationClock(
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

        await vscode.window
          .showInformationMessage(
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
        await vscode.commands
          .executeCommand(
            "workbench.action.openSettings",
            "@ext:ka0sdev.waddletracker",
          );
      },
    );

  const refreshStatisticsCommand =
    vscode.commands.registerCommand(
      "waddletracker.refreshStatistics",
      async () => {
        await currentActivityProvider
          .refresh();

        sessionHistoryProvider
          .refresh();

        await dashboardProvider
          .refresh();
      },
    );

  context.subscriptions.push(
    activityTracker,

    statusBar,

    currentActivityProvider,
    currentActivityRegistration,

    sessionHistoryProvider,
    sessionHistoryView,

    dashboardProvider,
    dashboardRegistration,

    showStatusCommand,
    openSettingsCommand,
    refreshStatisticsCommand,
  );

  activityTracker.start();

  console.log(
    "WaddleTracker activated.",
  );
}

export async function deactivate():
  Promise<void> {
  if (
    !activityTracker
  ) {
    return;
  }

  await activityTracker.disposeAsync();

  activityTracker =
    undefined;
}
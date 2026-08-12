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

        const exclusion =
          activityTracker.getCurrentExclusion();

        const duration =
          formatDurationClock(
            stats.activeMilliseconds,
          );

        const activityState =
          exclusion
            ? "Excluded"
            : activityTracker.isActive()
              ? "Active"
              : "Idle";

        const details = [
          "WaddleTracker",

          `Today: ${duration}`,

          `Status: ${activityState}`,
        ];

        if (
          exclusion
        ) {
          details.push(
            `Exclusion: ${exclusion.kind} (${exclusion.pattern})`,
          );
        }

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
        await refreshAllViews(
          currentActivityProvider,
          sessionHistoryProvider,
          dashboardProvider,
        );
      },
    );

  const excludeCurrentProjectCommand =
    vscode.commands.registerCommand(
      "waddletracker.excludeCurrentProject",
      async () => {
        if (
          !activityTracker
        ) {
          return;
        }

        const projectName =
          activityTracker
            .getCurrentContext()
            .projectName;

        if (
          !projectName
        ) {
          await vscode.window
            .showInformationMessage(
              "WaddleTracker could not determine the current project.",
            );

          return;
        }

        const added =
          await addTrackingExclusion(
            "tracking.excludedProjects",
            projectName,
          );

        if (
          added
        ) {
          await vscode.window
            .showInformationMessage(
              `WaddleTracker will no longer track project "${projectName}".`,
            );
        }
      },
    );

  const excludeCurrentFileCommand =
    vscode.commands.registerCommand(
      "waddletracker.excludeCurrentFile",
      async () => {
        if (
          !activityTracker
        ) {
          return;
        }

        const filePath =
          activityTracker
            .getCurrentContext()
            .filePath;

        if (
          !filePath
        ) {
          await vscode.window
            .showInformationMessage(
              "WaddleTracker could not determine the current file.",
            );

          return;
        }

        const added =
          await addTrackingExclusion(
            "tracking.excludedFiles",
            filePath,
          );

        if (
          added
        ) {
          await vscode.window
            .showInformationMessage(
              "WaddleTracker will no longer track the current file.",
            );
        }
      },
    );

  const resetStatisticsCommand =
    vscode.commands.registerCommand(
      "waddletracker.resetStatistics",
      async () => {
        if (
          !activityTracker
        ) {
          return;
        }

        const confirmation =
          await vscode.window
            .showWarningMessage(
              "Reset all WaddleTracker statistics? This permanently removes all recorded daily statistics and coding-session history. Tracking will continue from the reset point.",
              {
                modal:
                  true,

                detail:
                  "This action cannot be undone.",
              },
              "Reset Statistics",
            );

        if (
          confirmation !==
          "Reset Statistics"
        ) {
          return;
        }

        await activityTracker
          .resetStatistics();

        await refreshAllViews(
          currentActivityProvider,
          sessionHistoryProvider,
          dashboardProvider,
        );

        await vscode.window
          .showInformationMessage(
            "WaddleTracker statistics have been reset.",
          );
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
    excludeCurrentProjectCommand,
    excludeCurrentFileCommand,
    resetStatisticsCommand,
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

async function addTrackingExclusion(
  setting:
    "tracking.excludedProjects" |
    "tracking.excludedFiles",

  value:
    string,
): Promise<boolean> {
  const configuration =
    vscode.workspace.getConfiguration(
      "waddleTracker",
    );

  const currentValues =
    configuration.get<string[]>(
      setting,
      [],
    );

  if (
    currentValues.includes(
      value,
    )
  ) {
    await vscode.window
      .showInformationMessage(
        "This item is already excluded from WaddleTracker.",
      );

    return false;
  }

  await configuration.update(
    setting,
    [
      ...currentValues,
      value,
    ],
    vscode.ConfigurationTarget.Global,
  );

  return true;
}

async function refreshAllViews(
  currentActivityProvider:
    CurrentActivityProvider,

  sessionHistoryProvider:
    SessionHistoryTreeProvider,

  dashboardProvider:
    StatisticsDashboardProvider,
): Promise<void> {
  await currentActivityProvider
    .refresh();

  sessionHistoryProvider
    .refresh();

  await dashboardProvider
    .refresh();
}

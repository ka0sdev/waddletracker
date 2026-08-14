import * as vscode from "vscode";

import { ExportService } from "./data/ExportService";
import { ImportService } from "./data/ImportService";

import { SessionHistoryService } from "./sessions/SessionHistoryService";

import { JsonStorageProvider } from "./storage/JsonStorageProvider";

import { StatisticsService } from "./statistics/StatisticsService";

import { ActivityTracker } from "./tracking/ActivityTracker";
import { ContextResolver } from "./tracking/ContextResolver";
import { TrackingFilter } from "./tracking/TrackingFilter";

import { CodingActivityPanel } from "./ui/CodingActivityPanel";
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

  const trackingFilter =
    new TrackingFilter();

  const statisticsService =
    new StatisticsService();

  const sessionHistoryService =
    new SessionHistoryService();

  activityTracker =
    new ActivityTracker(
      storage,
      state,
      contextResolver,
      trackingFilter,
    );

  const exportService =
    new ExportService(
      async () => {
        if (
          !activityTracker
        ) {
          throw new Error(
            "WaddleTracker is not active.",
          );
        }

        return activityTracker
          .createStateSnapshot();
      },
    );

  const importService =
    new ImportService();

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

  const codingActivityPanel =
    new CodingActivityPanel(
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

  const includeCurrentProjectCommand =
    vscode.commands.registerCommand(
      "waddletracker.includeCurrentProject",
      async () => {
        if (
          !activityTracker
        ) {
          return;
        }

        const exclusion =
          activityTracker.getCurrentExclusion();

        if (
          !exclusion ||
          exclusion.kind !==
            "project"
        ) {
          await vscode.window
            .showInformationMessage(
              "The current project is not excluded by a project rule.",
            );

          return;
        }

        const removed =
          await removeTrackingExclusion(
            "tracking.excludedProjects",
            exclusion.pattern,
            "project",
          );

        if (
          removed
        ) {
          await vscode.window
            .showInformationMessage(
              `Removed project exclusion "${exclusion.pattern}".`,
            );
        }
      },
    );

  const includeCurrentFileCommand =
    vscode.commands.registerCommand(
      "waddletracker.includeCurrentFile",
      async () => {
        if (
          !activityTracker
        ) {
          return;
        }

        const exclusion =
          activityTracker.getCurrentExclusion();

        if (
          !exclusion ||
          exclusion.kind !==
            "file"
        ) {
          await vscode.window
            .showInformationMessage(
              "The current file is not excluded by a file rule.",
            );

          return;
        }

        const removed =
          await removeTrackingExclusion(
            "tracking.excludedFiles",
            exclusion.pattern,
            "file",
          );

        if (
          removed
        ) {
          await vscode.window
            .showInformationMessage(
              `Removed file exclusion "${exclusion.pattern}".`,
            );
        }
      },
    );

  const excludeExplorerFileCommand =
    vscode.commands.registerCommand(
      "waddletracker.excludeFile",
      async (
        resource:
          vscode.Uri,
      ) => {
        if (
          !resource
        ) {
          return;
        }

        const filePath =
          normalizeResourcePath(
            resource.fsPath,
          );

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
              `WaddleTracker will no longer track "${resource.path.split("/").at(-1) ?? filePath}".`,
            );
        }
      },
    );

  const includeExplorerFileCommand =
    vscode.commands.registerCommand(
      "waddletracker.includeFile",
      async (
        resource:
          vscode.Uri,
      ) => {
        if (
          !resource
        ) {
          return;
        }

        const filePath =
          normalizeResourcePath(
            resource.fsPath,
          );

        const fileName =
          resource.path
            .split("/")
            .at(
              -1,
            );

        const exclusion =
          trackingFilter
            .getFileExclusion(
              filePath,
              fileName,
            );

        if (
          !exclusion
        ) {
          await vscode.window
            .showInformationMessage(
              "The selected file is not excluded from WaddleTracker.",
            );

          return;
        }

        const removed =
          await removeTrackingExclusion(
            "tracking.excludedFiles",
            exclusion.pattern,
            "file",
          );

        if (
          removed
        ) {
          await vscode.window
            .showInformationMessage(
              `Removed file exclusion "${exclusion.pattern}".`,
            );
        }
      },
    );

  const excludeExplorerDirectoryCommand =
    vscode.commands.registerCommand(
      "waddletracker.excludeDirectory",
      async (
        resource:
          vscode.Uri,
      ) => {
        if (
          !resource
        ) {
          return;
        }

        const directoryPath =
          normalizeResourcePath(
            resource.fsPath,
          );

        const pattern =
          `${directoryPath}/**`;

        const added =
          await addTrackingExclusion(
            "tracking.excludedFiles",
            pattern,
          );

        if (
          added
        ) {
          await vscode.window
            .showInformationMessage(
              `WaddleTracker will no longer track files inside "${resource.path.split("/").at(-1) ?? directoryPath}".`,
            );
        }
      },
    );

  const includeExplorerDirectoryCommand =
    vscode.commands.registerCommand(
      "waddletracker.includeDirectory",
      async (
        resource:
          vscode.Uri,
      ) => {
        if (
          !resource
        ) {
          return;
        }

        const directoryPath =
          normalizeResourcePath(
            resource.fsPath,
          );

        const probePath =
          `${directoryPath}/__waddletracker_probe__`;

        const exclusion =
          trackingFilter
            .getFileExclusion(
              probePath,
            );

        if (
          !exclusion
        ) {
          await vscode.window
            .showInformationMessage(
              "The selected directory is not excluded from WaddleTracker.",
            );

          return;
        }

        const removed =
          await removeTrackingExclusion(
            "tracking.excludedFiles",
            exclusion.pattern,
            "directory",
          );

        if (
          removed
        ) {
          await vscode.window
            .showInformationMessage(
              `Removed directory exclusion "${exclusion.pattern}".`,
            );
        }
      },
    );

  const openCodingActivityCommand =
    vscode.commands.registerCommand(
      "waddletracker.openCodingActivity",
      () => {
        codingActivityPanel.show();
      },
    );

  const exportStatisticsCommand =
    vscode.commands.registerCommand(
      "waddletracker.exportStatistics",
      async () => {
        try {
          const exported =
            await exportService
              .exportStatistics();

          if (
            exported
          ) {
            await vscode.window
              .showInformationMessage(
                "WaddleTracker statistics exported successfully.",
              );
          }
        } catch (
          error
        ) {
          const message =
            error instanceof Error
              ? error.message
              : "Unknown export error.";

          await vscode.window
            .showErrorMessage(
              `WaddleTracker could not export statistics: ${message}`,
            );
        }
      },
    );

  const importStatisticsCommand =
    vscode.commands.registerCommand(
      "waddletracker.importStatistics",
      async () => {
        if (
          !activityTracker
        ) {
          return;
        }

        try {
          const selection =
            await importService
              .selectImport();

          if (
            !selection
          ) {
            return;
          }

          const summary =
            selection.summary;

          const confirmation =
            await vscode.window
              .showWarningMessage(
                "Import WaddleTracker statistics?",
                {
                  modal:
                    true,

                  detail:
                    [
                      `Exported: ${formatImportDate(
                        summary.exportedAt,
                      )}`,

                      `Active days: ${summary.activeDays}`,

                      `Sessions: ${summary.sessions}`,

                      `Tracked time: ${formatDurationClock(
                        summary.activeMilliseconds,
                      )}`,

                      "",

                      "This will replace all currently stored statistics and coding-session history.",

                      "This action cannot be undone unless you have exported the current statistics first.",
                    ].join(
                      "\n",
                    ),
                },
                "Import Statistics",
              );

          if (
            confirmation !==
            "Import Statistics"
          ) {
            return;
          }

          await activityTracker
            .replaceState(
              selection.state,
            );

          await refreshAllViews(
            currentActivityProvider,
            sessionHistoryProvider,
            dashboardProvider,
          );

          await vscode.window
            .showInformationMessage(
              "WaddleTracker statistics imported successfully.",
            );
        } catch (
          error
        ) {
          const message =
            error instanceof Error
              ? error.message
              : "Unknown import error.";

          await vscode.window
            .showErrorMessage(
              `WaddleTracker could not import statistics: ${message}`,
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

    codingActivityPanel,

    showStatusCommand,
    openSettingsCommand,
    refreshStatisticsCommand,
    excludeCurrentProjectCommand,
    excludeCurrentFileCommand,
    includeCurrentProjectCommand,
    includeCurrentFileCommand,
    excludeExplorerFileCommand,
    includeExplorerFileCommand,
    excludeExplorerDirectoryCommand,
    includeExplorerDirectoryCommand,
    openCodingActivityCommand,
    exportStatisticsCommand,
    importStatisticsCommand,
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

async function removeTrackingExclusion(
  setting:
    "tracking.excludedProjects" |
    "tracking.excludedFiles",

  pattern:
    string,

  kind:
    "project" |
    "file" |
    "directory",
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
    !currentValues.includes(
      pattern,
    )
  ) {
    await vscode.window
      .showInformationMessage(
        "The matching WaddleTracker exclusion rule no longer exists.",
      );

    return false;
  }

  const usesWildcard =
    pattern.includes(
      "*",
    ) ||
    pattern.includes(
      "?",
    );

  if (
    usesWildcard
  ) {
    const confirmation =
      await vscode.window
        .showWarningMessage(
          `Remove the ${kind} exclusion rule "${pattern}"?`,
          {
            modal:
              true,

            detail:
              "This is a wildcard rule and may currently exclude more than one item. Removing it will allow all matching items to be tracked again.",
          },
          "Remove Exclusion",
        );

    if (
      confirmation !==
      "Remove Exclusion"
    ) {
      return false;
    }
  }

  await configuration.update(
    setting,
    currentValues.filter(
      (value) =>
        value !==
        pattern,
    ),
    vscode.ConfigurationTarget.Global,
  );

  return true;
}

function formatImportDate(
  timestamp:
    string,
): string {
  return new Date(
    timestamp,
  ).toLocaleString(
    undefined,
    {
      year:
        "numeric",

      month:
        "short",

      day:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit",
    },
  );
}

function normalizeResourcePath(
  value:
    string,
): string {
  return value
    .replace(
      /\\/g,
      "/",
    )
    .replace(
      /\/+/g,
      "/",
    )
    .replace(
      /\/$/,
      "",
    );
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

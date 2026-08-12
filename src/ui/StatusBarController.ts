import * as vscode from "vscode";

import { ActivityTracker } from "../tracking/ActivityTracker";

import {
  formatDurationClock,
} from "../utils/formatters";

type StatusBarDisplayMode =
  | "today"
  | "project"
  | "session";

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
              "waddleTracker",
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

    const displayMode =
      configuration.get<StatusBarDisplayMode>(
        "statusBar.display",
        "today",
      );

    const stats =
      this.tracker.getTodayStats();

    const currentContext =
      this.tracker.getCurrentContext();

    const currentSession =
      this.tracker.getCurrentSession();

    const todayFormatted =
      formatDurationClock(
        stats.activeMilliseconds,
      );

    const sessionFormatted =
      formatDurationClock(
        currentSession
          ?.activeMilliseconds ??
          0,
      );

    switch (displayMode) {
      case "project":
        if (
          currentContext.projectName
        ) {
          this.item.text =
            `$(clock) ${todayFormatted} • ${currentContext.projectName}`;
        } else {
          this.item.text =
            `$(clock) ${todayFormatted}`;
        }

        break;

      case "session":
        this.item.text =
          `$(clock) ${sessionFormatted}`;

        break;

      case "today":
      default:
        this.item.text =
          `$(clock) ${todayFormatted}`;

        break;
    }

    const state =
      this.tracker.isActive()
        ? "Active"
        : "Idle";

    const tooltipParts = [
      "WaddleTracker",
      `Today: ${todayFormatted}`,
      `Status: ${state}`,
    ];

    if (currentSession) {
      tooltipParts.push(
        `Current session: ${sessionFormatted}`,
      );
    }

    if (
      currentContext.projectName
    ) {
      tooltipParts.push(
        `Project: ${currentContext.projectName}`,
      );
    }

    if (
      currentContext.languageId
    ) {
      tooltipParts.push(
        `Language: ${currentContext.languageId}`,
      );
    }

    this.item.tooltip =
      tooltipParts.join(
        "\n",
      );

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
}
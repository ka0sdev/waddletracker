import * as vscode from "vscode";

import {
  AutoSyncService,
  AutoSyncState,
} from "../sync/AutoSyncService";

const SYNCED_VISIBILITY_MS =
  4_000;

export class SyncStatusBarController
  implements vscode.Disposable
{
  private readonly item:
    vscode.StatusBarItem;

  private readonly disposables:
    vscode.Disposable[] = [];

  private hideTimer:
    NodeJS.Timeout |
    undefined;

  constructor(
    private readonly autoSyncService:
      AutoSyncService,
  ) {
    this.item =
      vscode.window
        .createStatusBarItem(
          vscode.StatusBarAlignment.Left,
          99,
        );

    this.item.command =
      "waddletracker.showSyncStatus";

    const stateSubscription =
      this.autoSyncService
        .onDidChangeState(
          (
            state,
          ) => {
            this.update(
              state,
            );
          },
        );

    this.disposables.push(
      {
        dispose:
          () => {
            stateSubscription
              .dispose();
          },
      },

      vscode.workspace
        .onDidChangeConfiguration(
          (
            event,
          ) => {
            if (
              event.affectsConfiguration(
                "waddleTracker.sync",
              )
            ) {
              this.update(
                this.autoSyncService
                  .getSyncState(),
              );
            }
          },
        ),
    );

    this.update(
      this.autoSyncService
        .getSyncState(),
    );
  }

  public dispose():
    void {
    this.clearHideTimer();

    for (
      const disposable
      of this.disposables
    ) {
      disposable.dispose();
    }

    this.item.dispose();
  }

  private update(
    state:
      AutoSyncState,
  ): void {
    this.clearHideTimer();

    const configuration =
      vscode.workspace
        .getConfiguration(
          "waddleTracker",
        );

    const syncEnabled =
      configuration.get<boolean>(
        "sync.enabled",
        false,
      );

    if (
      !syncEnabled ||
      state ===
        "idle"
    ) {
      this.item.hide();

      return;
    }

    switch (
      state
    ) {
      case "syncing":
        this.item.text =
          "$(sync~spin) Syncing…";

        this.item.tooltip =
          "WaddleTracker is synchronizing activity with the configured server.";

        this.item.show();

        break;

      case "synced":
        this.item.text =
          "$(check) Synced";

        this.item.tooltip =
          "WaddleTracker synchronization completed successfully. Click to show sync status.";

        this.item.show();

        this.hideTimer =
          setTimeout(
            () => {
              if (
                this.autoSyncService
                  .getSyncState() ===
                "synced"
              ) {
                this.item.hide();
              }

              this.hideTimer =
                undefined;
            },
            SYNCED_VISIBILITY_MS,
          );

        break;

      case "pending":
        this.item.text =
          "$(cloud-upload) Pending";

        this.item.tooltip =
          "WaddleTracker could not reach the configured server. The newest snapshot is cached locally and will be retried. Click to show sync status.";

        this.item.show();

        break;

      case "failed":
        this.item.text =
          "$(warning) Sync failed";

        this.item.tooltip =
          "WaddleTracker encountered a synchronization error. Click to show sync status.";

        this.item.show();

        break;

      default:
        this.item.hide();

        break;
    }
  }

  private clearHideTimer():
    void {
    if (
      !this.hideTimer
    ) {
      return;
    }

    clearTimeout(
      this.hideTimer,
    );

    this.hideTimer =
      undefined;
  }
}

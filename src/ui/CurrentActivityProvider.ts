import * as vscode from "vscode";

import { ActivityTracker } from "../tracking/ActivityTracker";

import {
  TrackingExclusion,
} from "../tracking/TrackingFilter";

import {
  formatLanguageName,
} from "../utils/formatters";

interface CurrentActivityData {
  active: boolean;

  todayMilliseconds: number;

  sessionMilliseconds: number;

  projectName:
    | string
    | undefined;

  languageName:
    | string
    | undefined;

  exclusion:
    | TrackingExclusion
    | undefined;
}

interface WebviewMessage {
  type?: string;
}

export class CurrentActivityProvider
  implements
    vscode.WebviewViewProvider,
    vscode.Disposable
{
  public static readonly viewType =
    "waddletracker.currentActivity";

  private view:
    vscode.WebviewView | undefined;

  private readonly disposables:
    vscode.Disposable[] = [];

  constructor(
    private readonly tracker:
      ActivityTracker,
  ) {
    this.disposables.push(
      this.tracker.onDidUpdate(
        () => {
          void this.sendActivity();
        },
      ),
    );
  }

  public resolveWebviewView(
    webviewView:
      vscode.WebviewView,

    _context:
      vscode.WebviewViewResolveContext,

    _token:
      vscode.CancellationToken,
  ): void {
    this.view =
      webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html =
      this.getHtml(
        webviewView.webview,
      );

    webviewView.onDidChangeVisibility(
      () => {
        if (
          webviewView.visible
        ) {
          void this.sendActivity();
        }
      },
      undefined,
      this.disposables,
    );

    webviewView.webview.onDidReceiveMessage(
      async (
        message:
          WebviewMessage,
      ) => {
        if (
          message.type ===
            "ready" ||
          message.type ===
            "refresh"
        ) {
          await this.sendActivity();
        }
      },
      undefined,
      this.disposables,
    );
  }

  public async refresh():
    Promise<void> {
    await this.sendActivity();
  }

  public dispose(): void {
    for (
      const disposable
      of this.disposables
    ) {
      disposable.dispose();
    }

    this.view =
      undefined;
  }

  private async sendActivity():
    Promise<void> {
    if (
      !this.view ||
      !this.view.visible
    ) {
      return;
    }

    const stats =
      this.tracker.getTodayStats();

    const context =
      this.tracker.getCurrentContext();

    const session =
      this.tracker.getCurrentSession();

    const exclusion =
      this.tracker.getCurrentExclusion();

    const data:
      CurrentActivityData = {
      active:
        this.tracker.isActive(),

      todayMilliseconds:
        stats.activeMilliseconds,

      sessionMilliseconds:
        session?.activeMilliseconds ??
        0,

      projectName:
        context.projectName,

      languageName:
        context.languageId
          ? formatLanguageName(
              context.languageId,
            )
          : undefined,

      exclusion,
    };

    await this.view.webview.postMessage({
      type:
        "activity",

      data,
    });
  }

  private getHtml(
    webview:
      vscode.Webview,
  ): string {
    const nonce =
      this.createNonce();

    return /* html */ `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <meta
    http-equiv="Content-Security-Policy"
    content="
      default-src 'none';
      style-src ${webview.cspSource} 'unsafe-inline';
      script-src 'nonce-${nonce}';
    "
  >

  <title>
    WaddleTracker Current Activity
  </title>

  <style>
    :root {
      color-scheme:
        light dark;
    }

    * {
      box-sizing:
        border-box;
    }

    body {
      margin:
        0;

      padding:
        12px;

      color:
        var(
          --vscode-foreground
        );

      background:
        var(
          --vscode-sideBar-background
        );

      font-family:
        var(
          --vscode-font-family
        );

      font-size:
        var(
          --vscode-font-size
        );
    }

    .activity {
      display:
        flex;

      flex-direction:
        column;

      gap:
        10px;
    }

    .activity-grid {
      display:
        grid;

      grid-template-columns:
        repeat(
          2,
          minmax(
            0,
            1fr
          )
        );

      gap:
        10px;
    }

    .activity-card {
      position:
        relative;

      display:
        flex;

      flex-direction:
        column;

      justify-content:
        center;

      min-width:
        0;

      min-height:
        74px;

      padding:
        12px;

      overflow:
        hidden;

      border:
        1px solid
        var(
          --vscode-panel-border,
          var(
            --vscode-widget-border
          )
        );

      border-radius:
        6px;

      background:
        var(
          --vscode-editorWidget-background,
          var(
            --vscode-editor-background
          )
        );

      transition:
        border-color
          100ms ease,
        background
          100ms ease;
    }

    .activity-card:hover {
      border-color:
        var(
          --vscode-focusBorder
        );
    }

    .project-card {
      min-height:
        78px;

      padding:
        14px;
    }

    .card-label {
      margin-bottom:
        7px;

      color:
        var(
          --vscode-descriptionForeground
        );

      font-size:
        10px;

      font-weight:
        600;

      letter-spacing:
        0.5px;

      line-height:
        1;

      text-transform:
        uppercase;

      overflow:
        hidden;

      text-overflow:
        ellipsis;

      white-space:
        nowrap;
    }

    .card-value {
      min-width:
        0;

      color:
        var(
          --vscode-foreground
        );

      font-size:
        16px;

      font-weight:
        600;

      line-height:
        1.25;

      overflow:
        hidden;

      text-overflow:
        ellipsis;

      white-space:
        nowrap;
    }

    .project-value {
      font-size:
        18px;
    }

    .status-value {
      display:
        flex;

      align-items:
        center;

      gap:
        7px;
    }

    .status-detail {
      display:
        none;

      min-width:
        0;

      margin-top:
        5px;

      color:
        var(
          --vscode-descriptionForeground
        );

      font-size:
        10px;

      font-weight:
        400;

      line-height:
        1.2;

      overflow:
        hidden;

      text-overflow:
        ellipsis;

      white-space:
        nowrap;
    }

    .status-detail.visible {
      display:
        block;
    }

    .status-indicator {
      display:
        inline-block;

      width:
        8px;

      height:
        8px;

      flex:
        0 0 auto;

      border-radius:
        50%;

      background:
        var(
          --vscode-descriptionForeground
        );
    }

    .status-indicator.active {
      background:
        var(
          --vscode-charts-green,
          var(
            --vscode-testing-iconPassed,
            var(
              --vscode-foreground
            )
          )
        );
    }

    .status-indicator.idle {
      opacity:
        0.45;
    }

    .status-indicator.excluded {
      background:
        var(
          --vscode-charts-yellow,
          var(
            --vscode-editorWarning-foreground,
            var(
              --vscode-foreground
            )
          )
        );

      opacity:
        1;
    }

    @media (
      max-width:
        240px
    ) {
      body {
        padding:
          10px 8px;
      }

      .activity,
      .activity-grid {
        gap:
          8px;
      }

      .activity-grid {
        grid-template-columns:
          1fr;
      }

      .activity-card {
        min-height:
          66px;
      }
    }
  </style>
</head>

<body>
  <div
    class="activity"
  >
    <section
      class="activity-card project-card"
    >
      <div
        class="card-label"
      >
        Project
      </div>

      <div
        class="card-value project-value"
        id="project-value"
        title="No project"
      >
        —
      </div>
    </section>

    <div
      class="activity-grid"
    >
      <section
        class="activity-card"
        id="status-card"
        title="WaddleTracker is idle."
      >
        <div
          class="card-label"
        >
          Status
        </div>

        <div
          class="card-value status-value"
        >
          <span
            class="status-indicator idle"
            id="status-indicator"
          ></span>

          <span
            id="status-value"
          >
            Idle
          </span>
        </div>

        <div
          class="status-detail"
          id="status-detail"
        ></div>
      </section>

      <section
        class="activity-card"
      >
        <div
          class="card-label"
        >
          Current Session
        </div>

        <div
          class="card-value"
          id="session-value"
        >
          No session
        </div>
      </section>

      <section
        class="activity-card"
      >
        <div
          class="card-label"
        >
          Today
        </div>

        <div
          class="card-value"
          id="today-value"
        >
          0s
        </div>
      </section>

      <section
        class="activity-card"
      >
        <div
          class="card-label"
        >
          Language
        </div>

        <div
          class="card-value"
          id="language-value"
          title="No language"
        >
          —
        </div>
      </section>
    </div>
  </div>

  <script
    nonce="${nonce}"
  >
    const vscode =
      acquireVsCodeApi();

    const projectValue =
      document.getElementById(
        "project-value"
      );

    const statusCard =
      document.getElementById(
        "status-card"
      );

    const statusValue =
      document.getElementById(
        "status-value"
      );

    const statusIndicator =
      document.getElementById(
        "status-indicator"
      );

    const statusDetail =
      document.getElementById(
        "status-detail"
      );

    const sessionValue =
      document.getElementById(
        "session-value"
      );

    const todayValue =
      document.getElementById(
        "today-value"
      );

    const languageValue =
      document.getElementById(
        "language-value"
      );

    window.addEventListener(
      "message",
      (event) => {
        const message =
          event.data;

        if (
          message.type !==
          "activity"
        ) {
          return;
        }

        renderActivity(
          message.data
        );
      },
    );

    function renderActivity(
      data
    ) {
      const project =
        data.projectName ??
        "No project";

      const language =
        data.languageName ??
        "No language";

      projectValue.textContent =
        project;

      projectValue.title =
        project;

      languageValue.textContent =
        language;

      languageValue.title =
        language;

      renderStatus(
        data
      );

      sessionValue.textContent =
        data.sessionMilliseconds > 0
          ? formatDuration(
              data.sessionMilliseconds
            )
          : "No session";

      todayValue.textContent =
        formatDuration(
          data.todayMilliseconds
        );
    }

    function renderStatus(
      data
    ) {
      statusIndicator.classList.remove(
        "active",
        "idle",
        "excluded",
      );

      if (
        data.exclusion
      ) {
        const kind =
          capitalize(
            data.exclusion.kind
          );

        const detail =
          kind +
          " • " +
          data.exclusion.pattern;

        statusValue.textContent =
          "Excluded";

        statusDetail.textContent =
          detail;

        statusDetail.classList.add(
          "visible"
        );

        statusIndicator.classList.add(
          "excluded"
        );

        statusCard.title =
          "Tracking excluded by " +
          data.exclusion.kind +
          " pattern: " +
          data.exclusion.pattern +
          "\\nMatched value: " +
          data.exclusion.value;

        return;
      }

      statusDetail.textContent =
        "";

      statusDetail.classList.remove(
        "visible"
      );

      if (
        data.active
      ) {
        statusValue.textContent =
          "Active";

        statusIndicator.classList.add(
          "active"
        );

        statusCard.title =
          "WaddleTracker is currently recording coding activity.";

        return;
      }

      statusValue.textContent =
        "Idle";

      statusIndicator.classList.add(
        "idle"
      );

      statusCard.title =
        "WaddleTracker is currently idle.";
    }

    function capitalize(
      value
    ) {
      if (
        !value
      ) {
        return "";
      }

      return (
        value.charAt(
          0
        ).toUpperCase() +
        value.slice(
          1
        )
      );
    }

    function formatDuration(
      milliseconds
    ) {
      const totalSeconds =
        Math.floor(
          milliseconds /
            1000
        );

      const hours =
        Math.floor(
          totalSeconds /
            3600
        );

      const minutes =
        Math.floor(
          (
            totalSeconds %
            3600
          ) /
            60
        );

      const seconds =
        totalSeconds %
        60;

      if (
        hours > 0
      ) {
        return (
          hours +
          "h " +
          minutes +
          "m"
        );
      }

      if (
        minutes > 0
      ) {
        return (
          minutes +
          "m " +
          seconds +
          "s"
        );
      }

      return (
        seconds +
        "s"
      );
    }

    vscode.postMessage({
      type:
        "ready",
    });
  </script>
</body>
</html>
`;
  }

  private createNonce():
    string {
    const characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    let nonce =
      "";

    for (
      let index = 0;
      index < 32;
      index += 1
    ) {
      nonce +=
        characters.charAt(
          Math.floor(
            Math.random() *
              characters.length,
          ),
        );
    }

    return nonce;
  }
}

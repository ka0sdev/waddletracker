import * as vscode from "vscode";

import { StatisticsService } from "../statistics/StatisticsService";

import {
  HistoricalStatistics,
  StatisticsRange,
} from "../types/StatisticsTypes";

import { ActivityTracker } from "../tracking/ActivityTracker";

const DASHBOARD_REFRESH_INTERVAL_MS =
  30_000;

interface DashboardData {
  today: HistoricalStatistics;
  sevenDays: HistoricalStatistics;
  thirtyDays: HistoricalStatistics;
  allTime: HistoricalStatistics;
}

export class StatisticsDashboardProvider
  implements
    vscode.WebviewViewProvider,
    vscode.Disposable
{
  public static readonly viewType =
    "waddletracker.dashboard";

  private view:
    vscode.WebviewView | undefined;

  private refreshTimer:
    NodeJS.Timeout | undefined;

  private readonly disposables:
    vscode.Disposable[] = [];

  constructor(
    private readonly tracker:
      ActivityTracker,

    private readonly statisticsService:
      StatisticsService,
  ) {
    this.disposables.push(
      this.tracker.onDidUpdate(
        () => {
          /*
           * The tracker updates every second.
           *
           * We deliberately do not push dashboard
           * updates on every tick. The dashboard
           * receives a periodic refresh instead.
           */
        },
      ),
    );

    this.refreshTimer =
      setInterval(
        () => {
          void this.sendStatistics();
        },
        DASHBOARD_REFRESH_INTERVAL_MS,
      );
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
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
          void this.sendStatistics();
        }
      },
      undefined,
      this.disposables,
    );

    webviewView.webview.onDidReceiveMessage(
      async (
        message: {
          type?: string;
        },
      ) => {
        if (
          message.type ===
          "ready"
        ) {
          await this.sendStatistics();
        }

        if (
          message.type ===
          "refresh"
        ) {
          await this.sendStatistics();
        }
      },
      undefined,
      this.disposables,
    );
  }

  public async refresh():
    Promise<void> {
    await this.sendStatistics();
  }

  public dispose(): void {
    if (
      this.refreshTimer
    ) {
      clearInterval(
        this.refreshTimer,
      );

      this.refreshTimer =
        undefined;
    }

    for (
      const disposable
      of this.disposables
    ) {
      disposable.dispose();
    }

    this.view =
      undefined;
  }

  private async sendStatistics():
    Promise<void> {
    if (
      !this.view ||
      !this.view.visible
    ) {
      return;
    }

    const history =
      this.tracker.getDailyHistory();

    const data: DashboardData = {
      today:
        this.statisticsService
          .getStatistics(
            history,
            "today",
          ),

      sevenDays:
        this.statisticsService
          .getStatistics(
            history,
            "7days",
          ),

      thirtyDays:
        this.statisticsService
          .getStatistics(
            history,
            "30days",
          ),

      allTime:
        this.statisticsService
          .getStatistics(
            history,
            "all",
          ),
    };

    await this.view.webview.postMessage({
      type: "statistics",
      data,
    });
  }

  private getHtml(
    webview: vscode.Webview,
  ): string {
    const nonce =
      this.createNonce();

    const cspSource =
      webview.cspSource;

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
      style-src ${cspSource} 'unsafe-inline';
      script-src 'nonce-${nonce}';
    "
  >

  <title>WaddleTracker Statistics</title>

  <style>
    :root {
      color-scheme: light dark;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 12px;

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

    button {
      font-family: inherit;
    }

    .dashboard {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .range-selector {
      display: grid;
      grid-template-columns:
        repeat(
          4,
          minmax(
            0,
            1fr
          )
        );

      gap: 4px;
    }

    .range-button {
      border:
        1px solid
        var(
          --vscode-button-border,
          transparent
        );

      border-radius: 3px;

      padding:
        5px 4px;

      color:
        var(
          --vscode-button-secondaryForeground
        );

      background:
        var(
          --vscode-button-secondaryBackground
        );

      cursor: pointer;

      font-size: 11px;

      white-space: nowrap;
    }

    .range-button:hover {
      background:
        var(
          --vscode-button-secondaryHoverBackground
        );
    }

    .range-button.active {
      color:
        var(
          --vscode-button-foreground
        );

      background:
        var(
          --vscode-button-background
        );
    }

    .metrics {
      display: grid;

      grid-template-columns:
        repeat(
          2,
          minmax(
            0,
            1fr
          )
        );

      gap: 8px;
    }

    .metric {
      min-width: 0;

      padding: 10px;

      border:
        1px solid
        var(
          --vscode-widget-border
        );

      border-radius: 4px;

      background:
        var(
          --vscode-editorWidget-background
        );
    }

    .metric-label {
      margin-bottom: 4px;

      color:
        var(
          --vscode-descriptionForeground
        );

      font-size: 11px;

      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .metric-value {
      font-size: 16px;
      font-weight: 600;

      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;

      gap: 8px;
    }

    .section-title {
      margin: 0;

      font-size: 12px;
      font-weight: 600;

      text-transform: uppercase;

      color:
        var(
          --vscode-sideBarSectionHeader-foreground
        );
    }

    .refresh-button {
      border: 0;

      padding:
        2px 5px;

      color:
        var(
          --vscode-descriptionForeground
        );

      background:
        transparent;

      cursor: pointer;
    }

    .refresh-button:hover {
      color:
        var(
          --vscode-foreground
        );
    }

    .activity-chart {
      display: flex;
      align-items: flex-end;

      gap: 3px;

      min-height: 100px;

      padding:
        10px 4px 4px 4px;

      border-bottom:
        1px solid
        var(
          --vscode-widget-border
        );
    }

    .activity-column {
      display: flex;
      flex: 1;

      align-items: flex-end;

      min-width: 3px;

      height: 90px;
    }

    .activity-bar {
      width: 100%;

      min-height: 2px;

      border-radius:
        2px 2px 0 0;

      background:
        var(
          --vscode-charts-blue
        );

      opacity: 0.85;
    }

    .activity-bar:hover {
      opacity: 1;
    }

    .activity-empty {
      padding:
        14px 0;

      color:
        var(
          --vscode-descriptionForeground
        );
    }

    .ranking {
      display: flex;
      flex-direction: column;
      gap: 9px;
    }

    .ranking-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .ranking-header {
      display: flex;
      align-items: center;
      justify-content: space-between;

      gap: 8px;
    }

    .ranking-name {
      min-width: 0;

      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .ranking-value {
      flex-shrink: 0;

      color:
        var(
          --vscode-descriptionForeground
        );

      font-size: 11px;
    }

    .progress {
      width: 100%;
      height: 4px;

      overflow: hidden;

      border-radius: 2px;

      background:
        var(
          --vscode-progressBar-background
        );

      opacity: 0.25;
    }

    .progress-fill {
      height: 100%;

      border-radius: 2px;

      background:
        var(
          --vscode-progressBar-background
        );

      opacity: 1;
    }

    .empty-state {
      color:
        var(
          --vscode-descriptionForeground
        );

      font-size: 12px;
    }
  </style>
</head>

<body>
  <div
    class="dashboard"
  >
    <div
      class="range-selector"
      aria-label="Statistics range"
    >
      <button
        class="range-button active"
        data-range="today"
        type="button"
      >
        Today
      </button>

      <button
        class="range-button"
        data-range="sevenDays"
        type="button"
      >
        7 Days
      </button>

      <button
        class="range-button"
        data-range="thirtyDays"
        type="button"
      >
        30 Days
      </button>

      <button
        class="range-button"
        data-range="allTime"
        type="button"
      >
        All
      </button>
    </div>

    <div
      class="metrics"
    >
      <div
        class="metric"
      >
        <div
          class="metric-label"
        >
          Coding time
        </div>

        <div
          class="metric-value"
          id="total-time"
        >
          —
        </div>
      </div>

      <div
        class="metric"
      >
        <div
          class="metric-label"
        >
          Active days
        </div>

        <div
          class="metric-value"
          id="active-days"
        >
          —
        </div>
      </div>

      <div
        class="metric"
      >
        <div
          class="metric-label"
        >
          Daily average
        </div>

        <div
          class="metric-value"
          id="average-time"
        >
          —
        </div>
      </div>

      <div
        class="metric"
      >
        <div
          class="metric-label"
        >
          Best day
        </div>

        <div
          class="metric-value"
          id="best-day"
        >
          —
        </div>
      </div>
    </div>

    <section
      class="section"
    >
      <div
        class="section-header"
      >
        <h2
          class="section-title"
        >
          Daily Activity
        </h2>

        <button
          class="refresh-button"
          id="refresh"
          type="button"
          title="Refresh statistics"
          aria-label="Refresh statistics"
        >
          ↻
        </button>
      </div>

      <div
        class="activity-chart"
        id="activity-chart"
      >
        <div
          class="activity-empty"
        >
          Waiting for statistics…
        </div>
      </div>
    </section>

    <section
      class="section"
    >
      <h2
        class="section-title"
      >
        Top Projects
      </h2>

      <div
        class="ranking"
        id="projects"
      ></div>
    </section>

    <section
      class="section"
    >
      <h2
        class="section-title"
      >
        Top Languages
      </h2>

      <div
        class="ranking"
        id="languages"
      ></div>
    </section>
  </div>

  <script
    nonce="${nonce}"
  >
    const vscode =
      acquireVsCodeApi();

    let dashboardData =
      undefined;

    let selectedRange =
      "today";

    const rangeButtons =
      document.querySelectorAll(
        ".range-button"
      );

    const totalTime =
      document.getElementById(
        "total-time"
      );

    const activeDays =
      document.getElementById(
        "active-days"
      );

    const averageTime =
      document.getElementById(
        "average-time"
      );

    const bestDay =
      document.getElementById(
        "best-day"
      );

    const activityChart =
      document.getElementById(
        "activity-chart"
      );

    const projects =
      document.getElementById(
        "projects"
      );

    const languages =
      document.getElementById(
        "languages"
      );

    const refreshButton =
      document.getElementById(
        "refresh"
      );

    for (
      const button
      of rangeButtons
    ) {
      button.addEventListener(
        "click",
        () => {
          selectedRange =
            button.dataset.range;

          updateRangeButtons();

          render();
        },
      );
    }

    refreshButton.addEventListener(
      "click",
      () => {
        vscode.postMessage({
          type: "refresh",
        });
      },
    );

    window.addEventListener(
      "message",
      (event) => {
        const message =
          event.data;

        if (
          message.type !==
          "statistics"
        ) {
          return;
        }

        dashboardData =
          message.data;

        render();
      },
    );

    function updateRangeButtons() {
      for (
        const button
        of rangeButtons
      ) {
        button.classList.toggle(
          "active",
          button.dataset.range ===
            selectedRange,
        );
      }
    }

    function render() {
      if (!dashboardData) {
        return;
      }

      const statistics =
        dashboardData[
          selectedRange
        ];

      if (!statistics) {
        return;
      }

      totalTime.textContent =
        formatDuration(
          statistics.activeMilliseconds,
        );

      activeDays.textContent =
        String(
          statistics.activeDays
        );

      averageTime.textContent =
        formatDuration(
          statistics.averageActiveMilliseconds,
        );

      bestDay.textContent =
        statistics.bestDay
          ? formatDuration(
              statistics
                .bestDay
                .activeMilliseconds,
            )
          : "—";

      if (
        statistics.bestDay
      ) {
        bestDay.title =
          statistics.bestDay.date;
      } else {
        bestDay.removeAttribute(
          "title"
        );
      }

      renderActivityChart(
        statistics.daily
      );

      renderRanking(
        projects,
        statistics.projects,
        false,
      );

      renderRanking(
        languages,
        statistics.languages,
        true,
      );
    }

    function renderActivityChart(
      daily
    ) {
      activityChart.replaceChildren();

      if (
        !daily ||
        daily.length === 0
      ) {
        const empty =
          document.createElement(
            "div"
          );

        empty.className =
          "activity-empty";

        empty.textContent =
          "No activity recorded for this range.";

        activityChart.appendChild(
          empty
        );

        return;
      }

      const maximum =
        Math.max(
          ...daily.map(
            (day) =>
              day.activeMilliseconds
          ),
          1,
        );

      for (
        const day
        of daily
      ) {
        const column =
          document.createElement(
            "div"
          );

        column.className =
          "activity-column";

        column.title =
          day.date +
          " — " +
          formatDuration(
            day.activeMilliseconds
          );

        const bar =
          document.createElement(
            "div"
          );

        bar.className =
          "activity-bar";

        const percentage =
          day.activeMilliseconds > 0
            ? Math.max(
                (
                  day.activeMilliseconds /
                  maximum
                ) *
                  100,
                3,
              )
            : 2;

        bar.style.height =
          percentage + "%";

        column.appendChild(
          bar
        );

        activityChart.appendChild(
          column
        );
      }
    }

    function renderRanking(
      container,
      items,
      languagesMode
    ) {
      container.replaceChildren();

      if (
        !items ||
        items.length === 0
      ) {
        const empty =
          document.createElement(
            "div"
          );

        empty.className =
          "empty-state";

        empty.textContent =
          "No activity recorded.";

        container.appendChild(
          empty
        );

        return;
      }

      for (
        const item
        of items.slice(
          0,
          5,
        )
      ) {
        const wrapper =
          document.createElement(
            "div"
          );

        wrapper.className =
          "ranking-item";

        const header =
          document.createElement(
            "div"
          );

        header.className =
          "ranking-header";

        const name =
          document.createElement(
            "span"
          );

        name.className =
          "ranking-name";

        name.textContent =
          languagesMode
            ? formatLanguageName(
                item.name
              )
            : item.name;

        name.title =
          name.textContent;

        const value =
          document.createElement(
            "span"
          );

        value.className =
          "ranking-value";

        value.textContent =
          formatDuration(
            item.activeMilliseconds
          ) +
          " • " +
          formatPercentage(
            item.percentage
          );

        header.append(
          name,
          value,
        );

        const progress =
          document.createElement(
            "div"
          );

        progress.className =
          "progress";

        const fill =
          document.createElement(
            "div"
          );

        fill.className =
          "progress-fill";

        fill.style.width =
          Math.min(
            Math.max(
              item.percentage,
              0,
            ),
            100,
          ) +
          "%";

        progress.appendChild(
          fill
        );

        wrapper.append(
          header,
          progress,
        );

        container.appendChild(
          wrapper
        );
      }
    }

    function formatDuration(
      milliseconds
    ) {
      const totalMinutes =
        Math.floor(
          milliseconds /
            60000
        );

      const hours =
        Math.floor(
          totalMinutes /
            60
        );

      const minutes =
        totalMinutes %
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
        totalMinutes > 0
      ) {
        return (
          totalMinutes +
          "m"
        );
      }

      const seconds =
        Math.floor(
          milliseconds /
            1000
        );

      return (
        seconds +
        "s"
      );
    }

    function formatPercentage(
      percentage
    ) {
      if (
        percentage > 0 &&
        percentage < 1
      ) {
        return "<1%";
      }

      return (
        Math.round(
          percentage
        ) +
        "%"
      );
    }

    function formatLanguageName(
      languageId
    ) {
      const known = {
        javascript:
          "JavaScript",

        javascriptreact:
          "JavaScript React",

        typescript:
          "TypeScript",

        typescriptreact:
          "TypeScript React",

        json:
          "JSON",

        jsonc:
          "JSON with Comments",

        markdown:
          "Markdown",

        html:
          "HTML",

        css:
          "CSS",

        scss:
          "SCSS",

        less:
          "Less",

        python:
          "Python",

        go:
          "Go",

        rust:
          "Rust",

        shellscript:
          "Shell Script",

        powershell:
          "PowerShell",

        yaml:
          "YAML",

        dockerfile:
          "Dockerfile",

        sql:
          "SQL",

        php:
          "PHP",

        java:
          "Java",

        c:
          "C",

        cpp:
          "C++",

        csharp:
          "C#",
      };

      return (
        known[
          languageId
        ] ??
        languageId
      );
    }

    vscode.postMessage({
      type: "ready",
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

    let nonce = "";

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
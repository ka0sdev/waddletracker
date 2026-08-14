import * as vscode from "vscode";

import { StatisticsService } from "../statistics/StatisticsService";

import {
  DailyActivityPoint,
  HistoricalStatistics,
  StreakStatistics,
} from "../types/StatisticsTypes";

import { ActivityTracker } from "../tracking/ActivityTracker";

const DASHBOARD_REFRESH_INTERVAL_MS =
  30_000;

interface DashboardData {
  today:
    HistoricalStatistics;

  sevenDays:
    HistoricalStatistics;

  thirtyDays:
    HistoricalStatistics;

  allTime:
    HistoricalStatistics;

  streaks:
    StreakStatistics;

  heatmap:
    DailyActivityPoint[];

  heatmapLabel:
    string;
}

interface WebviewMessage {
  type?:
    string;

  path?:
    string;
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
    this.refreshTimer =
      setInterval(
        () => {
          void this.sendStatistics();
        },
        DASHBOARD_REFRESH_INTERVAL_MS,
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
      enableScripts:
        true,
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
        message:
          WebviewMessage,
      ) => {
        switch (
          message.type
        ) {
          case "ready":
          case "refresh":
            await this.sendStatistics();

            break;

          case "openFile":
            if (
              message.path
            ) {
              await this.openFile(
                message.path,
              );
            }

            break;

          case "openCodingActivity":
            await vscode.commands
              .executeCommand(
                "waddletracker.openCodingActivity",
              );

            break;
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

    const now =
      new Date();

    const currentMonthDayCount =
      now.getDate();

    const data:
      DashboardData = {
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

      streaks:
        this.statisticsService
          .getStreakStatistics(
            history,
          ),

      heatmap:
        this.statisticsService
          .getCalendarActivity(
            history,
            currentMonthDayCount,
          ),

      heatmapLabel:
        now.toLocaleDateString(
          undefined,
          {
            month:
              "long",

            year:
              "numeric",
          },
        ),
    };

    await this.view.webview
      .postMessage({
        type:
          "statistics",

        data,
      });
  }

  private async openFile(
    filePath:
      string,
  ): Promise<void> {
    try {
      const document =
        await vscode.workspace
          .openTextDocument(
            vscode.Uri.file(
              filePath,
            ),
          );

      await vscode.window
        .showTextDocument(
          document,
          {
            preview:
              true,
          },
        );
    } catch {
      await vscode.window
        .showWarningMessage(
          `WaddleTracker could not open ${filePath}.`,
        );
    }
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
    WaddleTracker Statistics
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

    button {
      font-family:
        inherit;
    }

    .dashboard {
      display:
        flex;

      flex-direction:
        column;

      gap:
        18px;
    }

    .range-selector,
    .breakdown-tabs {
      display:
        grid;

      gap:
        4px;
    }

    .range-selector {
      grid-template-columns:
        repeat(
          4,
          minmax(
            0,
            1fr
          )
        );
    }

    .breakdown-tabs {
      grid-template-columns:
        repeat(
          3,
          minmax(
            0,
            1fr
          )
        );
    }

    .range-button,
    .breakdown-button,
    .link-button {
      border:
        1px solid
        var(
          --vscode-button-border,
          transparent
        );

      border-radius:
        3px;

      cursor:
        pointer;
    }

    .range-button,
    .breakdown-button {
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

      font-size:
        11px;

      white-space:
        nowrap;
    }

    .range-button:hover,
    .breakdown-button:hover {
      background:
        var(
          --vscode-button-secondaryHoverBackground
        );
    }

    .range-button.active,
    .breakdown-button.active {
      color:
        var(
          --vscode-button-foreground
        );

      background:
        var(
          --vscode-button-background
        );
    }

    .summary-grid {
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

    .summary-card {
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
          100ms ease;
    }

    .summary-card:hover {
      border-color:
        var(
          --vscode-focusBorder
        );
    }

    .summary-label {
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

    .summary-value {
      min-width:
        0;

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

    .summary-detail {
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

      overflow:
        hidden;

      text-overflow:
        ellipsis;

      white-space:
        nowrap;
    }

    .section {
      display:
        flex;

      flex-direction:
        column;

      gap:
        8px;
    }

    .section-header {
      display:
        flex;

      align-items:
        flex-start;

      justify-content:
        space-between;

      gap:
        8px;
    }

    .section-title {
      margin:
        0;

      color:
        var(
          --vscode-sideBarSectionHeader-foreground
        );

      font-size:
        12px;

      font-weight:
        600;

      text-transform:
        uppercase;
    }

    .section-context {
      margin-top:
        2px;

      color:
        var(
          --vscode-descriptionForeground
        );

      font-size:
        10px;
    }

    .activity-chart-scroll {
      overflow-x:
        auto;

      overflow-y:
        hidden;

      scrollbar-width:
        thin;
    }

    .activity-chart {
      display:
        flex;

      align-items:
        stretch;

      gap:
        3px;

      min-width:
        100%;

      min-height:
        118px;

      padding:
        8px 2px 0;

      border-bottom:
        1px solid
        var(
          --vscode-widget-border
        );
    }

    .activity-column {
      display:
        flex;

      flex:
        1 1 0;

      flex-direction:
        column;

      min-width:
        5px;

      height:
        110px;

      cursor:
        default;
    }

    .activity-bar-area {
      display:
        flex;

      flex:
        1;

      align-items:
        flex-end;

      min-height:
        0;
    }

    .activity-bar {
      width:
        100%;

      min-height:
        2px;

      border-radius:
        2px 2px 0 0;

      background:
        var(
          --vscode-charts-blue
        );

      opacity:
        0.85;
    }

    .activity-bar.zero {
      opacity:
        0.12;
    }

    .activity-date-label {
      min-height:
        16px;

      padding-top:
        4px;

      color:
        var(
          --vscode-descriptionForeground
        );

      font-size:
        9px;

      text-align:
        center;

      white-space:
        nowrap;
    }

    .ranking {
      display:
        flex;

      flex-direction:
        column;

      gap:
        9px;

      min-height:
        20px;
    }

    .ranking-item {
      display:
        flex;

      flex-direction:
        column;

      gap:
        4px;
    }

    .ranking-item.clickable {
      margin:
        -2px;

      padding:
        2px;

      border-radius:
        3px;

      cursor:
        pointer;
    }

    .ranking-item.clickable:hover {
      background:
        var(
          --vscode-list-hoverBackground
        );
    }

    .ranking-header {
      display:
        flex;

      align-items:
        center;

      justify-content:
        space-between;

      gap:
        8px;
    }

    .ranking-name {
      min-width:
        0;

      overflow:
        hidden;

      text-overflow:
        ellipsis;

      white-space:
        nowrap;
    }

    .ranking-value {
      flex-shrink:
        0;

      color:
        var(
          --vscode-descriptionForeground
        );

      font-size:
        11px;
    }

    .progress {
      width:
        100%;

      height:
        4px;

      overflow:
        hidden;

      border-radius:
        2px;

      background:
        color-mix(
          in srgb,
          var(
            --vscode-progressBar-background
          ) 25%,
          transparent
        );
    }

    .progress-fill {
      height:
        100%;

      border-radius:
        2px;

      background:
        var(
          --vscode-progressBar-background
        );
    }

    .heatmap-scroll {
      overflow-x:
        auto;

      overflow-y:
        hidden;

      padding-bottom:
        4px;

      scrollbar-width:
        thin;
    }

    .heatmap {
      display:
        grid;

      grid-template-rows:
        repeat(
          7,
          10px
        );

      grid-auto-flow:
        column;

      grid-auto-columns:
        10px;

      gap:
        2px;

      width:
        max-content;

      min-width:
        100%;
    }

    .heatmap-cell,
    .legend-cell {
      border-radius:
        2px;

      background:
        var(
          --vscode-charts-blue
        );
    }

    .heatmap-cell {
      width:
        10px;

      height:
        10px;

      cursor:
        default;
    }

    .heatmap-cell:hover {
      outline:
        1px solid
        var(
          --vscode-focusBorder
        );

      outline-offset:
        1px;
    }

    .heatmap-placeholder {
      width:
        10px;

      height:
        10px;
    }

    .heatmap-cell.level-0,
    .legend-cell.level-0 {
      background:
        var(
          --vscode-widget-border
        );

      opacity:
        0.35;
    }

    .heatmap-cell.level-1,
    .legend-cell.level-1 {
      opacity:
        0.25;
    }

    .heatmap-cell.level-2,
    .legend-cell.level-2 {
      opacity:
        0.45;
    }

    .heatmap-cell.level-3,
    .legend-cell.level-3 {
      opacity:
        0.7;
    }

    .heatmap-cell.level-4,
    .legend-cell.level-4 {
      opacity:
        1;
    }

    .heatmap-footer {
      display:
        flex;

      align-items:
        center;

      justify-content:
        space-between;

      gap:
        8px;
    }

    .heatmap-legend {
      display:
        flex;

      align-items:
        center;

      gap:
        3px;

      color:
        var(
          --vscode-descriptionForeground
        );

      font-size:
        10px;
    }

    .legend-cell {
      width:
        9px;

      height:
        9px;
    }

    .link-button {
      padding:
        3px 6px;

      color:
        var(
          --vscode-textLink-foreground
        );

      background:
        transparent;

      border-color:
        transparent;

      font-size:
        10px;
    }

    .link-button:hover {
      color:
        var(
          --vscode-textLink-activeForeground
        );

      text-decoration:
        underline;
    }

    .empty-state {
      color:
        var(
          --vscode-descriptionForeground
        );

      font-size:
        12px;
    }

    .dashboard-tooltip {
      position:
        fixed;

      z-index:
        1000;

      max-width:
        260px;

      padding:
        6px 8px;

      pointer-events:
        none;

      border:
        1px solid
        var(
          --vscode-editorHoverWidget-border,
          var(
            --vscode-widget-border
          )
        );

      border-radius:
        4px;

      color:
        var(
          --vscode-editorHoverWidget-foreground,
          var(
            --vscode-foreground
          )
        );

      background:
        var(
          --vscode-editorHoverWidget-background,
          var(
            --vscode-editorWidget-background
          )
        );

      font-size:
        11px;

      line-height:
        1.4;

      opacity:
        0;

      visibility:
        hidden;
    }

    .dashboard-tooltip.visible {
      opacity:
        1;

      visibility:
        visible;
    }

    @media (
      max-width:
        240px
    ) {
      body {
        padding:
          10px 8px;
      }

      .summary-grid {
        grid-template-columns:
          1fr;
      }
    }
  </style>
</head>

<body>
  <main
    class="dashboard"
  >
    <div
      class="range-selector"
      role="tablist"
      aria-label="Statistics range"
    >
      <button
        class="range-button"
        data-range="today"
      >
        Today
      </button>

      <button
        class="range-button"
        data-range="7days"
      >
        7 Days
      </button>

      <button
        class="range-button"
        data-range="30days"
      >
        30 Days
      </button>

      <button
        class="range-button"
        data-range="all"
      >
        All
      </button>
    </div>

    <section
      class="summary-grid"
    >
      <article
        class="summary-card"
      >
        <div
          class="summary-label"
        >
          Coding Time
        </div>

        <div
          class="summary-value"
          id="coding-time"
        >
          0s
        </div>
      </article>

      <article
        class="summary-card"
      >
        <div
          class="summary-label"
        >
          Active Days
        </div>

        <div
          class="summary-value"
          id="active-days"
        >
          0
        </div>
      </article>

      <article
        class="summary-card"
      >
        <div
          class="summary-label"
        >
          Daily Average
        </div>

        <div
          class="summary-value"
          id="daily-average"
        >
          0s
        </div>
      </article>

      <article
        class="summary-card"
      >
        <div
          class="summary-label"
        >
          Best Day
        </div>

        <div
          class="summary-value"
          id="best-day"
        >
          —
        </div>

        <div
          class="summary-detail"
          id="best-day-detail"
        ></div>
      </article>

      <article
        class="summary-card"
      >
        <div
          class="summary-label"
        >
          Current Streak
        </div>

        <div
          class="summary-value"
          id="current-streak"
        >
          0 days
        </div>

        <div
          class="summary-detail"
          id="current-streak-detail"
        ></div>
      </article>

      <article
        class="summary-card"
      >
        <div
          class="summary-label"
        >
          Longest Streak
        </div>

        <div
          class="summary-value"
          id="longest-streak"
        >
          0 days
        </div>

        <div
          class="summary-detail"
          id="longest-streak-detail"
        ></div>
      </article>
    </section>

    <section
      class="section"
    >
      <header
        class="section-header"
      >
        <div>
          <h2
            class="section-title"
          >
            Daily Activity
          </h2>

          <div
            class="section-context"
            id="activity-context"
          ></div>
        </div>
      </header>

      <div
        class="activity-chart-scroll"
      >
        <div
          class="activity-chart"
          id="activity-chart"
        ></div>
      </div>
    </section>

    <section
      class="section"
    >
      <header
        class="section-header"
      >
        <div>
          <h2
            class="section-title"
          >
            Breakdown
          </h2>

          <div
            class="section-context"
            id="breakdown-context"
          ></div>
        </div>
      </header>

      <div
        class="breakdown-tabs"
        role="tablist"
      >
        <button
          class="breakdown-button"
          data-breakdown="projects"
        >
          Projects
        </button>

        <button
          class="breakdown-button"
          data-breakdown="languages"
        >
          Languages
        </button>

        <button
          class="breakdown-button"
          data-breakdown="files"
        >
          Files
        </button>
      </div>

      <div
        class="ranking"
        id="ranking"
      ></div>
    </section>

    <section
      class="section"
    >
      <header
        class="section-header"
      >
        <div>
          <h2
            class="section-title"
          >
            Coding Activity
          </h2>

          <div
            class="section-context"
            id="heatmap-context"
          >
            Current month
          </div>
        </div>
      </header>

      <div
        class="heatmap-scroll"
        id="heatmap-scroll"
      >
        <div
          class="heatmap"
          id="heatmap"
        ></div>
      </div>

      <footer
        class="heatmap-footer"
      >
        <div
          class="heatmap-legend"
        >
          <span>
            Less
          </span>

          <span
            class="legend-cell level-0"
          ></span>

          <span
            class="legend-cell level-1"
          ></span>

          <span
            class="legend-cell level-2"
          ></span>

          <span
            class="legend-cell level-3"
          ></span>

          <span
            class="legend-cell level-4"
          ></span>

          <span>
            More
          </span>
        </div>

        <button
          class="link-button"
          id="open-full-activity"
          type="button"
        >
          Open Full Activity ↗
        </button>
      </footer>
    </section>
  </main>

  <div
    class="dashboard-tooltip"
    id="tooltip"
    role="tooltip"
  ></div>

  <script
    nonce="${nonce}"
  >
    const vscode =
      acquireVsCodeApi();

    const previousState =
      vscode.getState() ?? {};

    let currentRange =
      previousState.range ??
      "7days";

    let currentBreakdown =
      previousState.breakdown ??
      "projects";

    let statisticsData =
      undefined;

    const rangeButtons =
      Array.from(
        document.querySelectorAll(
          ".range-button"
        )
      );

    const breakdownButtons =
      Array.from(
        document.querySelectorAll(
          ".breakdown-button"
        )
      );

    const codingTime =
      document.getElementById(
        "coding-time"
      );

    const activeDays =
      document.getElementById(
        "active-days"
      );

    const dailyAverage =
      document.getElementById(
        "daily-average"
      );

    const bestDay =
      document.getElementById(
        "best-day"
      );

    const bestDayDetail =
      document.getElementById(
        "best-day-detail"
      );

    const currentStreak =
      document.getElementById(
        "current-streak"
      );

    const currentStreakDetail =
      document.getElementById(
        "current-streak-detail"
      );

    const longestStreak =
      document.getElementById(
        "longest-streak"
      );

    const longestStreakDetail =
      document.getElementById(
        "longest-streak-detail"
      );

    const activityContext =
      document.getElementById(
        "activity-context"
      );

    const activityChart =
      document.getElementById(
        "activity-chart"
      );

    const breakdownContext =
      document.getElementById(
        "breakdown-context"
      );

    const ranking =
      document.getElementById(
        "ranking"
      );

    const heatmapContext =
      document.getElementById(
        "heatmap-context"
      );

    const heatmap =
      document.getElementById(
        "heatmap"
      );

    const tooltip =
      document.getElementById(
        "tooltip"
      );

    document
      .getElementById(
        "open-full-activity"
      )
      .addEventListener(
        "click",
        () => {
          vscode.postMessage({
            type:
              "openCodingActivity",
          });
        },
      );

    for (
      const button
      of rangeButtons
    ) {
      button.addEventListener(
        "click",
        () => {
          currentRange =
            button.dataset.range;

          persistState();
          render();
        },
      );
    }

    for (
      const button
      of breakdownButtons
    ) {
      button.addEventListener(
        "click",
        () => {
          currentBreakdown =
            button.dataset.breakdown;

          persistState();
          render();
        },
      );
    }

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

        statisticsData =
          message.data;

        render();
      },
    );

    function persistState() {
      vscode.setState({
        range:
          currentRange,

        breakdown:
          currentBreakdown,
      });
    }

    function render() {
      if (
        !statisticsData
      ) {
        return;
      }

      const selected =
        getSelectedStatistics();

      renderRangeButtons();
      renderSummary(
        selected,
        statisticsData.streaks
      );
      renderDailyActivity(
        selected
      );
      renderBreakdown(
        selected
      );
      renderHeatmap(
        statisticsData.heatmap
      );

      heatmapContext.textContent =
        statisticsData.heatmapLabel;
    }

    function getSelectedStatistics() {
      switch (
        currentRange
      ) {
        case "today":
          return statisticsData.today;

        case "30days":
          return statisticsData.thirtyDays;

        case "all":
          return statisticsData.allTime;

        case "7days":
        default:
          return statisticsData.sevenDays;
      }
    }

    function renderRangeButtons() {
      for (
        const button
        of rangeButtons
      ) {
        button.classList.toggle(
          "active",
          button.dataset.range ===
            currentRange
        );
      }

      for (
        const button
        of breakdownButtons
      ) {
        button.classList.toggle(
          "active",
          button.dataset.breakdown ===
            currentBreakdown
        );
      }
    }

    function renderSummary(
      selected,
      streaks
    ) {
      codingTime.textContent =
        formatDuration(
          selected.activeMilliseconds
        );

      activeDays.textContent =
        String(
          selected.activeDays
        );

      dailyAverage.textContent =
        formatDuration(
          selected.averageActiveMilliseconds
        );

      if (
        selected.bestDay
      ) {
        bestDay.textContent =
          formatDuration(
            selected.bestDay
              .activeMilliseconds
          );

        bestDayDetail.textContent =
          formatDate(
            selected.bestDay.date
          );
      } else {
        bestDay.textContent =
          "—";

        bestDayDetail.textContent =
          "";
      }

      currentStreak.textContent =
        formatDayCount(
          streaks.currentDays
        );

      currentStreakDetail.textContent =
        formatDateRange(
          streaks.currentStartDate,
          streaks.currentEndDate
        );

      longestStreak.textContent =
        formatDayCount(
          streaks.longestDays
        );

      longestStreakDetail.textContent =
        formatDateRange(
          streaks.longestStartDate,
          streaks.longestEndDate
        );
    }

    function renderDailyActivity(
      selected
    ) {
      activityChart.replaceChildren();

      const daily =
        selected.daily ?? [];

      activityContext.textContent =
        describeRange(
          selected
        );

      if (
        daily.length === 0
      ) {
        activityChart.innerHTML =
          '<div class="empty-state">No activity</div>';

        return;
      }

      const max =
        Math.max(
          ...daily.map(
            (point) =>
              point.activeMilliseconds
          ),
          1
        );

      const minimumWidth =
        currentRange ===
        "all"
          ? Math.max(
              daily.length * 8,
              240
            )
          : 0;

      activityChart.style.minWidth =
        minimumWidth > 0
          ? minimumWidth + "px"
          : "100%";

      daily.forEach(
        (
          point,
          index
        ) => {
          const column =
            document.createElement(
              "div"
            );

          column.className =
            "activity-column";

          const area =
            document.createElement(
              "div"
            );

          area.className =
            "activity-bar-area";

          const bar =
            document.createElement(
              "div"
            );

          bar.className =
            "activity-bar";

          if (
            point.activeMilliseconds ===
            0
          ) {
            bar.classList.add(
              "zero"
            );
          }

          const percentage =
            Math.max(
              point.activeMilliseconds > 0
                ? 4
                : 2,
              (
                point.activeMilliseconds /
                max
              ) * 100
            );

          bar.style.height =
            percentage + "%";

          area.appendChild(
            bar
          );

          const label =
            document.createElement(
              "div"
            );

          label.className =
            "activity-date-label";

          const showLabel =
            daily.length <= 14 ||
            index === 0 ||
            index ===
              daily.length - 1 ||
            index %
              Math.ceil(
                daily.length / 6
              ) ===
              0;

          label.textContent =
            showLabel
              ? formatShortDate(
                  point.date
                )
              : "";

          column.append(
            area,
            label
          );

          attachTooltip(
            column,
            () =>
              formatDate(
                point.date
              ) +
              "\\n" +
              formatDuration(
                point.activeMilliseconds
              )
          );

          activityChart.appendChild(
            column
          );
        },
      );
    }

    function renderBreakdown(
      selected
    ) {
      ranking.replaceChildren();

      const entries =
        selected[
          currentBreakdown
        ] ?? [];

      const visible =
        entries.slice(
          0,
          5
        );

      if (
        entries.length ===
        0
      ) {
        breakdownContext.textContent =
          "No activity";

        ranking.innerHTML =
          '<div class="empty-state">No activity</div>';

        return;
      }

      breakdownContext.textContent =
        entries.length > 5
          ? "Top 5 of " +
            entries.length
          : entries.length +
            (
              entries.length === 1
                ? " entry"
                : " entries"
            );

      for (
        const entry
        of visible
      ) {
        const item =
          document.createElement(
            "div"
          );

        item.className =
          "ranking-item";

        const isFile =
          currentBreakdown ===
          "files";

        if (
          isFile
        ) {
          item.classList.add(
            "clickable"
          );

          item.tabIndex =
            0;

          item.setAttribute(
            "role",
            "button"
          );
        }

        const header =
          document.createElement(
            "div"
          );

        header.className =
          "ranking-header";

        const name =
          document.createElement(
            "div"
          );

        name.className =
          "ranking-name";

        name.textContent =
          isFile
            ? fileName(
                entry.name
              )
            : entry.name;

        const value =
          document.createElement(
            "div"
          );

        value.className =
          "ranking-value";

        value.textContent =
          formatDuration(
            entry.activeMilliseconds
          ) +
          " • " +
          formatPercentage(
            entry.percentage
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
          Math.max(
            0,
            Math.min(
              100,
              entry.percentage
            )
          ) +
          "%";

        progress.appendChild(
          fill
        );

        header.append(
          name,
          value
        );

        item.append(
          header,
          progress
        );

        attachTooltip(
          item,
          () =>
            (
              isFile
                ? entry.name
                : entry.name
            ) +
            "\\n" +
            formatDuration(
              entry.activeMilliseconds
            ) +
            " • " +
            formatPercentage(
              entry.percentage
            )
        );

        if (
          isFile
        ) {
          const open =
            () => {
              vscode.postMessage({
                type:
                  "openFile",

                path:
                  entry.name,
              });
            };

          item.addEventListener(
            "click",
            open
          );

          item.addEventListener(
            "keydown",
            (event) => {
              if (
                event.key ===
                  "Enter" ||
                event.key ===
                  " "
              ) {
                event.preventDefault();
                open();
              }
            },
          );
        }

        ranking.appendChild(
          item
        );
      }
    }

    function renderHeatmap(
      points
    ) {
      heatmap.replaceChildren();

      if (
        !points ||
        points.length === 0
      ) {
        heatmap.innerHTML =
          '<div class="empty-state">No activity</div>';

        return;
      }

      const firstDate =
        parseDateKey(
          points[0].date
        );

      const leadingDays =
        firstDate.getDay();

      for (
        let index = 0;
        index < leadingDays;
        index += 1
      ) {
        const placeholder =
          document.createElement(
            "div"
          );

        placeholder.className =
          "heatmap-placeholder";

        heatmap.appendChild(
          placeholder
        );
      }

      const positiveValues =
        points
          .map(
            (point) =>
              point.activeMilliseconds
          )
          .filter(
            (value) =>
              value > 0
          );

      const max =
        Math.max(
          ...positiveValues,
          1
        );

      for (
        const point
        of points
      ) {
        const cell =
          document.createElement(
            "div"
          );

        cell.className =
          "heatmap-cell level-" +
          heatLevel(
            point.activeMilliseconds,
            max
          );

        attachTooltip(
          cell,
          () =>
            formatDate(
              point.date
            ) +
            "\\n" +
            formatDuration(
              point.activeMilliseconds
            )
        );

        heatmap.appendChild(
          cell
        );
      }
    }

    function heatLevel(
      value,
      max
    ) {
      if (
        value <= 0
      ) {
        return 0;
      }

      const ratio =
        value / max;

      if (
        ratio <= 0.25
      ) {
        return 1;
      }

      if (
        ratio <= 0.5
      ) {
        return 2;
      }

      if (
        ratio <= 0.75
      ) {
        return 3;
      }

      return 4;
    }

    function attachTooltip(
      element,
      getText
    ) {
      element.addEventListener(
        "mouseenter",
        (event) => {
          tooltip.textContent =
            getText();

          tooltip.classList.add(
            "visible"
          );

          positionTooltip(
            event
          );
        },
      );

      element.addEventListener(
        "mousemove",
        positionTooltip,
      );

      element.addEventListener(
        "mouseleave",
        () => {
          tooltip.classList.remove(
            "visible"
          );
        },
      );
    }

    function positionTooltip(
      event
    ) {
      const offset =
        12;

      const width =
        tooltip.offsetWidth;

      const height =
        tooltip.offsetHeight;

      let left =
        event.clientX +
        offset;

      let top =
        event.clientY +
        offset;

      if (
        left + width >
        window.innerWidth - 4
      ) {
        left =
          event.clientX -
          width -
          offset;
      }

      if (
        top + height >
        window.innerHeight - 4
      ) {
        top =
          event.clientY -
          height -
          offset;
      }

      tooltip.style.left =
        Math.max(
          4,
          left
        ) +
        "px";

      tooltip.style.top =
        Math.max(
          4,
          top
        ) +
        "px";
    }

    function describeRange(
      selected
    ) {
      if (
        selected.range ===
        "today"
      ) {
        return "Today";
      }

      if (
        selected.range ===
        "7days"
      ) {
        return "Last 7 days";
      }

      if (
        selected.range ===
        "30days"
      ) {
        return "Last 30 days";
      }

      return selected.startDate
        ? formatDate(
            selected.startDate
          ) +
          " – " +
          formatDate(
            selected.endDate
          )
        : "All time";
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

    function formatPercentage(
      value
    ) {
      if (
        value < 1 &&
        value > 0
      ) {
        return "<1%";
      }

      return (
        Math.round(
          value
        ) +
        "%"
      );
    }

    function formatDayCount(
      value
    ) {
      return (
        value +
        (
          value === 1
            ? " day"
            : " days"
        )
      );
    }

    function formatDateRange(
      start,
      end
    ) {
      if (
        !start ||
        !end
      ) {
        return "";
      }

      if (
        start === end
      ) {
        return formatDate(
          start
        );
      }

      return (
        formatDate(
          start
        ) +
        " – " +
        formatDate(
          end
        )
      );
    }

    function formatDate(
      date
    ) {
      return parseDateKey(
        date
      ).toLocaleDateString(
        undefined,
        {
          month:
            "short",

          day:
            "numeric",

          year:
            "numeric",
        }
      );
    }

    function formatShortDate(
      date
    ) {
      return parseDateKey(
        date
      ).toLocaleDateString(
        undefined,
        {
          month:
            "short",

          day:
            "numeric",
        }
      );
    }

    function parseDateKey(
      date
    ) {
      const [
        year,
        month,
        day
      ] =
        date
          .split(
            "-"
          )
          .map(
            Number
          );

      return new Date(
        year,
        month - 1,
        day
      );
    }

    function fileName(
      value
    ) {
      return value
        .replace(
          /\\\\/g,
          "/"
        )
        .split(
          "/"
        )
        .at(
          -1
        ) ??
        value;
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

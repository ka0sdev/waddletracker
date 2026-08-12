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

const HEATMAP_DAY_COUNT =
  365;

interface DashboardData {
  today: HistoricalStatistics;

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
            "ready" ||
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

      streaks:
        this.statisticsService
          .getStreakStatistics(
            history,
          ),

      heatmap:
        this.statisticsService
          .getCalendarActivity(
            history,
            HEATMAP_DAY_COUNT,
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
      font-family:
        inherit;
    }

    .dashboard {
      display: flex;

      flex-direction:
        column;

      gap: 18px;
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

    .range-button,
    .breakdown-button {
      border:
        1px solid
        var(
          --vscode-button-border,
          transparent
        );

      border-radius:
        3px;

      color:
        var(
          --vscode-button-secondaryForeground
        );

      background:
        var(
          --vscode-button-secondaryBackground
        );

      cursor:
        pointer;

      font-size:
        11px;

      white-space:
        nowrap;
    }

    .range-button {
      padding:
        5px 4px;
    }

    .breakdown-button {
      padding:
        5px 8px;
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

    .metrics,
    .streak-grid {
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

    .metric,
    .streak-card {
      min-width: 0;

      padding: 10px;

      border:
        1px solid
        var(
          --vscode-widget-border
        );

      border-radius:
        4px;

      background:
        var(
          --vscode-editorWidget-background
        );
    }

    .metric-label,
    .streak-label {
      margin-bottom:
        4px;

      color:
        var(
          --vscode-descriptionForeground
        );

      font-size:
        11px;

      overflow:
        hidden;

      text-overflow:
        ellipsis;

      white-space:
        nowrap;
    }

    .metric-value,
    .streak-value {
      font-size:
        16px;

      font-weight:
        600;

      overflow:
        hidden;

      text-overflow:
        ellipsis;

      white-space:
        nowrap;
    }

    .streak-detail {
      margin-top:
        4px;

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
      display: flex;

      flex-direction:
        column;

      gap: 8px;
    }

    .section-header {
      display: flex;

      align-items:
        center;

      justify-content:
        space-between;

      gap: 8px;
    }

    .section-title {
      margin: 0;

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
      color:
        var(
          --vscode-descriptionForeground
        );

      font-size:
        10px;
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

      cursor:
        pointer;
    }

    .refresh-button:hover {
      color:
        var(
          --vscode-foreground
        );
    }

    .activity-chart {
      display: flex;

      align-items:
        stretch;

      gap: 3px;

      min-height:
        118px;

      padding:
        8px 2px 0 2px;

      border-bottom:
        1px solid
        var(
          --vscode-widget-border
        );
    }

    .activity-column {
      display: flex;

      flex:
        1 1 0;

      flex-direction:
        column;

      min-width:
        3px;

      height:
        110px;
    }

    .activity-bar-area {
      display: flex;

      flex: 1;

      align-items:
        flex-end;

      min-height: 0;
    }

    .activity-bar {
      width: 100%;

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

    .activity-bar:hover {
      opacity:
        1;
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

    .activity-empty {
      padding:
        14px 0;

      color:
        var(
          --vscode-descriptionForeground
        );
    }

    .breakdown-tabs {
      display: grid;

      grid-template-columns:
        repeat(
          3,
          minmax(
            0,
            1fr
          )
        );

      gap: 4px;
    }

    .ranking {
      display: flex;

      flex-direction:
        column;

      gap: 9px;

      min-height:
        20px;
    }

    .ranking-item {
      display: flex;

      flex-direction:
        column;

      gap: 4px;
    }

    .ranking-header {
      display: flex;

      align-items:
        center;

      justify-content:
        space-between;

      gap: 8px;
    }

    .ranking-name {
      min-width: 0;

      overflow:
        hidden;

      text-overflow:
        ellipsis;

      white-space:
        nowrap;
    }

    .ranking-value {
      flex-shrink: 0;

      color:
        var(
          --vscode-descriptionForeground
        );

      font-size:
        11px;
    }

    .progress {
      width: 100%;

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
      height: 100%;

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
      display: grid;

      grid-template-rows:
        repeat(
          7,
          10px
        );

      grid-auto-flow:
        column;

      grid-auto-columns:
        10px;

      gap: 2px;

      width:
        max-content;

      min-width:
        100%;
    }

    .heatmap-cell {
      width:
        10px;

      height:
        10px;

      border-radius:
        2px;

      background:
        var(
          --vscode-charts-blue
        );
    }

    .heatmap-cell.level-0 {
      background:
        var(
          --vscode-widget-border
        );

      opacity:
        0.35;
    }

    .heatmap-cell.level-1 {
      opacity:
        0.25;
    }

    .heatmap-cell.level-2 {
      opacity:
        0.45;
    }

    .heatmap-cell.level-3 {
      opacity:
        0.7;
    }

    .heatmap-cell.level-4 {
      opacity:
        1;
    }

    .heatmap-placeholder {
      width:
        10px;

      height:
        10px;
    }

    .heatmap-footer {
      display: flex;

      align-items:
        center;

      justify-content:
        space-between;

      gap: 8px;

      color:
        var(
          --vscode-descriptionForeground
        );

      font-size:
        10px;
    }

    .heatmap-legend {
      display: flex;

      align-items:
        center;

      gap: 3px;
    }

    .legend-cell {
      width:
        9px;

      height:
        9px;

      border-radius:
        2px;

      background:
        var(
          --vscode-charts-blue
        );
    }

    .legend-cell.level-0 {
      background:
        var(
          --vscode-widget-border
        );

      opacity:
        0.35;
    }

    .legend-cell.level-1 {
      opacity:
        0.25;
    }

    .legend-cell.level-2 {
      opacity:
        0.45;
    }

    .legend-cell.level-3 {
      opacity:
        0.7;
    }

    .legend-cell.level-4 {
      opacity:
        1;
    }

    .empty-state {
      color:
        var(
          --vscode-descriptionForeground
        );

      font-size:
        12px;
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
      <h2
        class="section-title"
      >
        Streaks
      </h2>

      <div
        class="streak-grid"
      >
        <div
          class="streak-card"
        >
          <div
            class="streak-label"
          >
            Current streak
          </div>

          <div
            class="streak-value"
            id="current-streak"
          >
            —
          </div>

          <div
            class="streak-detail"
            id="current-streak-detail"
          ></div>
        </div>

        <div
          class="streak-card"
        >
          <div
            class="streak-label"
          >
            Longest streak
          </div>

          <div
            class="streak-value"
            id="longest-streak"
          >
            —
          </div>

          <div
            class="streak-detail"
            id="longest-streak-detail"
          ></div>
        </div>
      </div>
    </section>

    <section
      class="section"
    >
      <div
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
        Breakdown
      </h2>

      <div
        class="breakdown-tabs"
        aria-label="Statistics breakdown"
      >
        <button
          class="breakdown-button active"
          data-breakdown="projects"
          type="button"
        >
          Projects
        </button>

        <button
          class="breakdown-button"
          data-breakdown="languages"
          type="button"
        >
          Languages
        </button>

        <button
          class="breakdown-button"
          data-breakdown="files"
          type="button"
        >
          Files
        </button>
      </div>

      <div
        class="ranking"
        id="breakdown-ranking"
      ></div>
    </section>

    <section
      class="section"
    >
      <div>
        <h2
          class="section-title"
        >
          Coding Activity
        </h2>

        <div
          class="section-context"
        >
          Last 365 days
        </div>
      </div>

      <div
        class="heatmap-scroll"
        id="heatmap-scroll"
      >
        <div
          class="heatmap"
          id="heatmap"
        ></div>
      </div>

      <div
        class="heatmap-footer"
      >
        <span>
          Daily coding time
        </span>

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
      </div>
    </section>
  </div>

  <script
    nonce="${nonce}"
  >
    const vscode =
      acquireVsCodeApi();

    const previousState =
      vscode.getState() ?? {};

    let dashboardData =
      undefined;

    let selectedRange =
      previousState.selectedRange ??
      "today";

    let selectedBreakdown =
      previousState.selectedBreakdown ??
      "projects";

    const rangeButtons =
      document.querySelectorAll(
        ".range-button"
      );

    const breakdownButtons =
      document.querySelectorAll(
        ".breakdown-button"
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

    const breakdownRanking =
      document.getElementById(
        "breakdown-ranking"
      );

    const heatmap =
      document.getElementById(
        "heatmap"
      );

    const heatmapScroll =
      document.getElementById(
        "heatmap-scroll"
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

          persistState();

          updateRangeButtons();

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
          selectedBreakdown =
            button.dataset.breakdown;

          persistState();

          updateBreakdownButtons();

          renderBreakdown();
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

    function persistState() {
      vscode.setState({
        selectedRange,
        selectedBreakdown,
      });
    }

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

    function updateBreakdownButtons() {
      for (
        const button
        of breakdownButtons
      ) {
        button.classList.toggle(
          "active",
          button.dataset.breakdown ===
            selectedBreakdown,
        );
      }
    }

    function render() {
      if (!dashboardData) {
        return;
      }

      const statistics =
        getSelectedStatistics();

      if (!statistics) {
        return;
      }

      updateRangeButtons();

      updateBreakdownButtons();

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
          formatFullDate(
            statistics.bestDay.date
          );
      } else {
        bestDay.removeAttribute(
          "title"
        );
      }

      activityContext.textContent =
        formatRangeContext(
          statistics
        );

      renderStreaks(
        dashboardData.streaks
      );

      renderActivityChart(
        statistics.daily
      );

      renderBreakdown();

      renderHeatmap(
        dashboardData.heatmap
      );
    }

    function renderStreaks(
      streaks
    ) {
      if (!streaks) {
        return;
      }

      currentStreak.textContent =
        formatDays(
          streaks.currentDays
        );

      longestStreak.textContent =
        formatDays(
          streaks.longestDays
        );

      currentStreakDetail.textContent =
        formatStreakRange(
          streaks.currentStartDate,
          streaks.currentEndDate,
        );

      longestStreakDetail.textContent =
        formatStreakRange(
          streaks.longestStartDate,
          streaks.longestEndDate,
        );

      currentStreak.title =
        currentStreakDetail.textContent;

      longestStreak.title =
        longestStreakDetail.textContent;
    }

    function renderBreakdown() {
      const statistics =
        getSelectedStatistics();

      if (!statistics) {
        return;
      }

      let items =
        [];

      let mode =
        selectedBreakdown;

      switch (
        selectedBreakdown
      ) {
        case "languages":
          items =
            statistics.languages;

          break;

        case "files":
          items =
            statistics.files;

          break;

        case "projects":
        default:
          items =
            statistics.projects;

          mode =
            "projects";

          break;
      }

      renderRanking(
        breakdownRanking,
        items,
        mode,
      );
    }

    function getSelectedStatistics() {
      if (!dashboardData) {
        return undefined;
      }

      return dashboardData[
        selectedRange
      ];
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
        let index = 0;
        index <
        daily.length;
        index += 1
      ) {
        const day =
          daily[index];

        const column =
          document.createElement(
            "div"
          );

        column.className =
          "activity-column";

        column.title =
          formatFullDate(
            day.date
          ) +
          " — " +
          formatDuration(
            day.activeMilliseconds
          );

        const barArea =
          document.createElement(
            "div"
          );

        barArea.className =
          "activity-bar-area";

        const bar =
          document.createElement(
            "div"
          );

        bar.className =
          "activity-bar";

        if (
          day.activeMilliseconds ===
          0
        ) {
          bar.classList.add(
            "zero"
          );
        }

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

        barArea.appendChild(
          bar
        );

        const label =
          document.createElement(
            "div"
          );

        label.className =
          "activity-date-label";

        if (
          shouldShowDateLabel(
            daily,
            index,
          )
        ) {
          label.textContent =
            formatChartDate(
              day.date,
              daily.length,
            );
        }

        column.append(
          barArea,
          label,
        );

        activityChart.appendChild(
          column
        );
      }
    }

    function shouldShowDateLabel(
      daily,
      index
    ) {
      const length =
        daily.length;

      if (
        length <= 7
      ) {
        return true;
      }

      if (
        length <= 31
      ) {
        return (
          index === 0 ||
          index ===
            length - 1 ||
          index % 7 === 0
        );
      }

      if (
        index === 0 ||
        index ===
          length - 1
      ) {
        return true;
      }

      const current =
        parseLocalDate(
          daily[index].date
        );

      const previous =
        parseLocalDate(
          daily[index - 1].date
        );

      return (
        current.getMonth() !==
        previous.getMonth()
      );
    }

    function renderRanking(
      container,
      items,
      mode
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

        if (
          mode === "languages"
        ) {
          empty.textContent =
            "No language activity recorded.";
        } else if (
          mode === "files"
        ) {
          empty.textContent =
            "No file activity recorded.";
        } else {
          empty.textContent =
            "No project activity recorded.";
        }

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

        if (
          mode === "languages"
        ) {
          name.textContent =
            formatLanguageName(
              item.name
            );
        } else if (
          mode === "files"
        ) {
          name.textContent =
            getFileName(
              item.name
            );
        } else {
          name.textContent =
            item.name;
        }

        name.title =
          item.name;

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

    function renderHeatmap(
      daily
    ) {
      heatmap.replaceChildren();

      if (
        !daily ||
        daily.length === 0
      ) {
        return;
      }

      const firstDate =
        parseLocalDate(
          daily[0].date
        );

      const leadingEmptyCells =
        (
          firstDate.getDay() +
          6
        ) %
        7;

      for (
        let index = 0;
        index <
        leadingEmptyCells;
        index += 1
      ) {
        const placeholder =
          document.createElement(
            "span"
          );

        placeholder.className =
          "heatmap-placeholder";

        heatmap.appendChild(
          placeholder
        );
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
        const cell =
          document.createElement(
            "span"
          );

        const level =
          getHeatmapLevel(
            day.activeMilliseconds,
            maximum,
          );

        cell.className =
          "heatmap-cell level-" +
          level;

        cell.title =
          formatFullDate(
            day.date
          ) +
          " — " +
          formatDuration(
            day.activeMilliseconds
          );

        heatmap.appendChild(
          cell
        );
      }

      requestAnimationFrame(
        () => {
          heatmapScroll.scrollLeft =
            heatmapScroll.scrollWidth;
        },
      );
    }

    function getHeatmapLevel(
      milliseconds,
      maximum
    ) {
      if (
        milliseconds <= 0
      ) {
        return 0;
      }

      const ratio =
        milliseconds /
        maximum;

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

    function formatRangeContext(
      statistics
    ) {
      if (
        !statistics.startDate ||
        !statistics.endDate
      ) {
        return "";
      }

      if (
        statistics.startDate ===
        statistics.endDate
      ) {
        return formatFullDate(
          statistics.startDate
        );
      }

      return (
        formatShortDate(
          statistics.startDate
        ) +
        " – " +
        formatShortDate(
          statistics.endDate
        )
      );
    }

    function formatStreakRange(
      startDate,
      endDate
    ) {
      if (
        !startDate ||
        !endDate
      ) {
        return "No active streak";
      }

      if (
        startDate ===
        endDate
      ) {
        return formatShortDate(
          startDate
        );
      }

      return (
        formatShortDate(
          startDate
        ) +
        " – " +
        formatShortDate(
          endDate
        )
      );
    }

    function formatDays(
      days
    ) {
      return (
        days +
        (
          days === 1
            ? " day"
            : " days"
        )
      );
    }

    function formatChartDate(
      date,
      length
    ) {
      const value =
        parseLocalDate(
          date
        );

      if (
        length <= 7
      ) {
        return value
          .toLocaleDateString(
            undefined,
            {
              weekday:
                "short",
            },
          );
      }

      if (
        length <= 31
      ) {
        return value
          .toLocaleDateString(
            undefined,
            {
              month:
                "short",

              day:
                "numeric",
            },
          );
      }

      return value
        .toLocaleDateString(
          undefined,
          {
            month:
              "short",
          },
        );
    }

    function formatFullDate(
      date
    ) {
      return parseLocalDate(
        date
      ).toLocaleDateString(
        undefined,
        {
          weekday:
            "long",

          year:
            "numeric",

          month:
            "long",

          day:
            "numeric",
        },
      );
    }

    function formatShortDate(
      date
    ) {
      return parseLocalDate(
        date
      ).toLocaleDateString(
        undefined,
        {
          year:
            "numeric",

          month:
            "short",

          day:
            "numeric",
        },
      );
    }

    function parseLocalDate(
      date
    ) {
      const parts =
        date
          .split("-")
          .map(Number);

      return new Date(
        parts[0],
        parts[1] - 1,
        parts[2],
      );
    }

    function getFileName(
      filePath
    ) {
      const normalized =
        filePath.replace(
          /\\\\/g,
          "/",
        );

      const parts =
        normalized.split(
          "/"
        );

      return (
        parts.at(-1) ??
        filePath
      );
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

    updateRangeButtons();

    updateBreakdownButtons();

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
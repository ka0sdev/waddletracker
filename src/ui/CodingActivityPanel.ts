import * as vscode from "vscode";

import { StatisticsService } from "../statistics/StatisticsService";

import {
  DailyActivityPoint,
} from "../types/StatisticsTypes";

import {
  DailyDimensionStats,
  DailyStats,
} from "../types/TrackerState";

import {
  CodingSession,
} from "../types/CodingSession";

import { ActivityTracker } from "../tracking/ActivityTracker";

const ACTIVITY_DAY_COUNT =
  365;

const PANEL_REFRESH_INTERVAL_MS =
  30_000;

interface DayDimension {
  name:
    string;

  activeMilliseconds:
    number;

  percentage:
    number;
}

interface DaySession {
  id:
    string;

  projectName:
    string |
    undefined;

  workspaceName:
    string |
    undefined;

  startedAt:
    string;

  endedAt:
    string |
    undefined;

  activeMilliseconds:
    number;
}

interface CodingActivityDayDetail {
  date:
    string;

  activeMilliseconds:
    number;

  projects:
    DayDimension[];

  languages:
    DayDimension[];

  files:
    DayDimension[];

  sessions:
    DaySession[];
}

interface CodingActivityData {
  activity:
    DailyActivityPoint[];

  days:
    Record<
      string,
      CodingActivityDayDetail
    >;

  today:
    string;
}

interface PanelMessage {
  type?:
    string;

  path?:
    string;
}

export class CodingActivityPanel
  implements vscode.Disposable
{
  private panel:
    vscode.WebviewPanel | undefined;

  private refreshTimer:
    NodeJS.Timeout | undefined;

  private readonly disposables:
    vscode.Disposable[] = [];

  constructor(
    private readonly tracker:
      ActivityTracker,

    private readonly statisticsService:
      StatisticsService,
  ) {}

  public show(): void {
    if (
      this.panel
    ) {
      this.panel.reveal(
        vscode.ViewColumn.One,
      );

      void this.sendActivity();

      return;
    }

    this.panel =
      vscode.window.createWebviewPanel(
        "waddletracker.codingActivity",
        "WaddleTracker — Coding Activity",
        vscode.ViewColumn.One,
        {
          enableScripts:
            true,

          retainContextWhenHidden:
            true,
        },
      );

    this.panel.webview.html =
      this.getHtml(
        this.panel.webview,
      );

    this.panel.webview.onDidReceiveMessage(
      async (
        message:
          PanelMessage,
      ) => {
        if (
          message.type ===
            "ready" ||
          message.type ===
            "refresh"
        ) {
          await this.sendActivity();

          return;
        }

        if (
          message.type ===
            "openFile" &&
          message.path
        ) {
          await this.openFile(
            message.path,
          );
        }
      },
      undefined,
      this.disposables,
    );

    this.panel.onDidDispose(
      () => {
        this.panel =
          undefined;

        this.stopRefreshTimer();
      },
      undefined,
      this.disposables,
    );

    this.startRefreshTimer();
  }

  public async refresh():
    Promise<void> {
    await this.sendActivity();
  }

  public dispose(): void {
    this.stopRefreshTimer();

    this.panel?.dispose();
    this.panel =
      undefined;

    for (
      const disposable
      of this.disposables
    ) {
      disposable.dispose();
    }
  }

  private startRefreshTimer(): void {
    this.stopRefreshTimer();

    this.refreshTimer =
      setInterval(
        () => {
          void this.sendActivity();
        },
        PANEL_REFRESH_INTERVAL_MS,
      );
  }

  private stopRefreshTimer(): void {
    if (
      !this.refreshTimer
    ) {
      return;
    }

    clearInterval(
      this.refreshTimer,
    );

    this.refreshTimer =
      undefined;
  }

  private async sendActivity():
    Promise<void> {
    if (
      !this.panel
    ) {
      return;
    }

    const history =
      this.tracker.getDailyHistory();

    const sessions =
      this.tracker.getSessions();

    const activity =
      this.statisticsService
        .getCalendarActivity(
          history,
          ACTIVITY_DAY_COUNT,
        );

    const data:
      CodingActivityData = {
      activity,

      days:
        this.createDayDetails(
          activity,
          history,
          sessions,
        ),

      today:
        this.getLocalDateKey(
          new Date(),
        ),
    };

    await this.panel.webview
      .postMessage({
        type:
          "activity",

        data,
      });
  }

  private createDayDetails(
    activity:
      readonly DailyActivityPoint[],

    history:
      readonly DailyStats[],

    sessions:
      readonly CodingSession[],
  ): Record<
    string,
    CodingActivityDayDetail
  > {
    const historyByDate =
      new Map(
        history.map(
          (day) => [
            day.date,
            day,
          ],
        ),
      );

    const sessionsByDate =
      new Map<
        string,
        DaySession[]
      >();

    for (
      const session
      of sessions
    ) {
      const date =
        this.getLocalDateKey(
          new Date(
            session.startedAt,
          ),
        );

      const existing =
        sessionsByDate.get(
          date,
        ) ?? [];

      existing.push({
        id:
          session.id,

        projectName:
          session.projectName,

        workspaceName:
          session.workspaceName,

        startedAt:
          session.startedAt,

        endedAt:
          session.endedAt,

        activeMilliseconds:
          session.activeMilliseconds,
      });

      sessionsByDate.set(
        date,
        existing,
      );
    }

    return Object.fromEntries(
      activity.map(
        (point) => {
          const day =
            historyByDate.get(
              point.date,
            );

          const activeMilliseconds =
            day?.activeMilliseconds ??
            point.activeMilliseconds;

          return [
            point.date,
            {
              date:
                point.date,

              activeMilliseconds,

              projects:
                this.createDimensions(
                  day?.projects,
                  activeMilliseconds,
                ),

              languages:
                this.createDimensions(
                  day?.languages,
                  activeMilliseconds,
                ),

              files:
                this.createDimensions(
                  day?.files,
                  activeMilliseconds,
                ),

              sessions:
                (
                  sessionsByDate.get(
                    point.date,
                  ) ?? []
                )
                  .sort(
                    (
                      first,
                      second,
                    ) =>
                      new Date(
                        first.startedAt,
                      ).getTime() -
                      new Date(
                        second.startedAt,
                      ).getTime(),
                  ),
            },
          ];
        },
      ),
    );
  }

  private createDimensions(
    values:
      Record<
        string,
        DailyDimensionStats
      > |
      undefined,

    totalMilliseconds:
      number,
  ): DayDimension[] {
    if (
      !values
    ) {
      return [];
    }

    return Object.entries(
      values,
    )
      .map(
        (
          [
            name,
            statistics,
          ],
        ): DayDimension => ({
          name,

          activeMilliseconds:
            statistics.activeMilliseconds,

          percentage:
            totalMilliseconds > 0
              ? (
                  statistics.activeMilliseconds /
                  totalMilliseconds
                ) *
                100
              : 0,
        }),
      )
      .sort(
        (
          first,
          second,
        ) =>
          second.activeMilliseconds -
          first.activeMilliseconds,
      );
  }

  private getLocalDateKey(
    date:
      Date,
  ): string {
    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1,
      ).padStart(
        2,
        "0",
      );

    const day =
      String(
        date.getDate(),
      ).padStart(
        2,
        "0",
      );

    return (
      `${year}-${month}-${day}`
    );
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
    WaddleTracker — Coding Activity
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
        24px;

      color:
        var(
          --vscode-foreground
        );

      background:
        var(
          --vscode-editor-background
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

    .page {
      width:
        min(
          1100px,
          100%
        );

      margin:
        0 auto;
    }

    .header {
      display:
        flex;

      align-items:
        flex-end;

      justify-content:
        space-between;

      gap:
        20px;

      margin-bottom:
        22px;
    }

    h1,
    h2,
    h3 {
      margin:
        0;
    }

    h1 {
      font-size:
        22px;

      font-weight:
        600;
    }

    h2 {
      font-size:
        16px;

      font-weight:
        600;
    }

    h3 {
      font-size:
        11px;

      font-weight:
        600;

      letter-spacing:
        0.4px;

      text-transform:
        uppercase;
    }

    .subtitle,
    .muted {
      color:
        var(
          --vscode-descriptionForeground
        );
    }

    .subtitle {
      margin-top:
        5px;
    }

    .card {
      padding:
        18px;

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
    }

    .months {
      position:
        relative;

      height:
        18px;

      margin-left:
        28px;

      margin-bottom:
        6px;

      color:
        var(
          --vscode-descriptionForeground
        );

      font-size:
        10px;
    }

    .month-label {
      position:
        absolute;

      white-space:
        nowrap;
    }

    .heatmap-row {
      display:
        flex;

      gap:
        8px;
    }

    .weekday-labels {
      display:
        grid;

      grid-template-rows:
        repeat(
          7,
          12px
        );

      gap:
        3px;

      width:
        20px;

      flex:
        0 0 auto;

      color:
        var(
          --vscode-descriptionForeground
        );

      font-size:
        9px;
    }

    .weekday-label {
      display:
        flex;

      align-items:
        center;
    }

    .heatmap-scroll {
      overflow-x:
        auto;

      overflow-y:
        hidden;

      padding:
        2px 2px 8px;

      scrollbar-width:
        thin;
    }

    .heatmap {
      display:
        grid;

      grid-template-rows:
        repeat(
          7,
          12px
        );

      grid-auto-flow:
        column;

      grid-auto-columns:
        12px;

      gap:
        3px;

      width:
        max-content;
    }

    .cell {
      width:
        12px;

      height:
        12px;

      padding:
        0;

      border:
        0;

      border-radius:
        2px;

      background:
        var(
          --vscode-charts-blue
        );

      cursor:
        pointer;
    }

    .cell:hover {
      outline:
        1px solid
        var(
          --vscode-focusBorder
        );

      outline-offset:
        1px;
    }

    .cell.selected {
      outline:
        2px solid
        var(
          --vscode-focusBorder
        );

      outline-offset:
        1px;
    }

    .placeholder {
      width:
        12px;

      height:
        12px;
    }

    .cell.level-0,
    .legend-cell.level-0 {
      background:
        var(
          --vscode-widget-border
        );

      opacity:
        0.35;
    }

    .cell.level-1,
    .legend-cell.level-1 {
      opacity:
        0.25;
    }

    .cell.level-2,
    .legend-cell.level-2 {
      opacity:
        0.45;
    }

    .cell.level-3,
    .legend-cell.level-3 {
      opacity:
        0.7;
    }

    .cell.level-4,
    .legend-cell.level-4 {
      opacity:
        1;
    }

    .footer {
      display:
        flex;

      align-items:
        center;

      justify-content:
        flex-end;

      margin-top:
        14px;
    }

    .legend {
      display:
        flex;

      align-items:
        center;

      gap:
        4px;

      color:
        var(
          --vscode-descriptionForeground
        );

      font-size:
        10px;
    }

    .legend-cell {
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

    .day-details {
      display:
        flex;

      flex-direction:
        column;

      gap:
        16px;

      margin-top:
        18px;
    }

    .details-header {
      display:
        flex;

      align-items:
        flex-start;

      justify-content:
        space-between;

      gap:
        16px;
    }

    .details-date {
      margin-top:
        4px;

      color:
        var(
          --vscode-descriptionForeground
        );
    }

    .summary-grid {
      display:
        grid;

      grid-template-columns:
        repeat(
          3,
          minmax(
            0,
            1fr
          )
        );

      gap:
        10px;
    }

    .summary-card {
      min-width:
        0;

      padding:
        12px;

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
          --vscode-editor-background
        );
    }

    .summary-label {
      margin-bottom:
        6px;

      color:
        var(
          --vscode-descriptionForeground
        );

      font-size:
        10px;

      font-weight:
        600;

      letter-spacing:
        0.4px;

      text-transform:
        uppercase;
    }

    .summary-value {
      font-size:
        18px;

      font-weight:
        600;
    }

    .details-grid {
      display:
        grid;

      grid-template-columns:
        repeat(
          3,
          minmax(
            0,
            1fr
          )
        );

      gap:
        16px;
    }

    .detail-section {
      min-width:
        0;
    }

    .detail-list {
      display:
        flex;

      flex-direction:
        column;

      gap:
        8px;

      margin-top:
        9px;
    }

    .detail-item {
      display:
        flex;

      align-items:
        center;

      justify-content:
        space-between;

      gap:
        10px;

      min-width:
        0;
    }

    .detail-item.clickable {
      margin:
        -3px;

      padding:
        3px;

      border-radius:
        4px;

      cursor:
        pointer;
    }

    .detail-item.clickable:hover {
      background:
        var(
          --vscode-list-hoverBackground
        );
    }

    .detail-item.clickable:focus {
      outline:
        1px solid
        var(
          --vscode-focusBorder
        );

      outline-offset:
        1px;
    }

    .detail-name {
      min-width:
        0;

      overflow:
        hidden;

      text-overflow:
        ellipsis;

      white-space:
        nowrap;
    }

    .detail-value {
      flex:
        0 0 auto;

      color:
        var(
          --vscode-descriptionForeground
        );

      font-size:
        11px;

      white-space:
        nowrap;
    }

    .sessions {
      display:
        flex;

      flex-direction:
        column;

      gap:
        8px;
    }

    .session-item {
      display:
        grid;

      grid-template-columns:
        minmax(
          0,
          1fr
        )
        auto
        auto;

      align-items:
        center;

      gap:
        12px;

      padding:
        9px 10px;

      border:
        1px solid
        var(
          --vscode-widget-border
        );

      border-radius:
        4px;
    }

    .session-project {
      min-width:
        0;

      overflow:
        hidden;

      text-overflow:
        ellipsis;

      white-space:
        nowrap;
    }

    .session-time,
    .session-duration {
      color:
        var(
          --vscode-descriptionForeground
        );

      font-size:
        11px;

      white-space:
        nowrap;
    }

    .empty {
      color:
        var(
          --vscode-descriptionForeground
        );
    }

    .tooltip {
      position:
        fixed;

      z-index:
        1000;

      max-width:
        280px;

      padding:
        7px 9px;

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

      white-space:
        pre-line;

      opacity:
        0;

      visibility:
        hidden;
    }

    .tooltip.visible {
      opacity:
        1;

      visibility:
        visible;
    }

    @media (
      max-width:
        760px
    ) {
      body {
        padding:
          16px;
      }

      .header,
      .details-header {
        align-items:
          flex-start;

        flex-direction:
          column;
      }

      .summary-grid,
      .details-grid {
        grid-template-columns:
          1fr;
      }

      .session-item {
        grid-template-columns:
          minmax(
            0,
            1fr
          )
          auto;
      }

      .session-time {
        grid-column:
          1 /
          -1;
      }
    }
  </style>
</head>

<body>
  <main
    class="page"
  >
    <header
      class="header"
    >
      <div>
        <h1>
          Coding Activity
        </h1>

        <div
          class="subtitle"
        >
          Last 365 days
        </div>
      </div>
    </header>

    <section
      class="card"
    >
      <div
        class="months"
        id="months"
      ></div>

      <div
        class="heatmap-row"
      >
        <div
          class="weekday-labels"
          aria-hidden="true"
        >
          <div></div>
          <div
            class="weekday-label"
          >
            Mon
          </div>
          <div></div>
          <div
            class="weekday-label"
          >
            Wed
          </div>
          <div></div>
          <div
            class="weekday-label"
          >
            Fri
          </div>
          <div></div>
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
      </div>

      <footer
        class="footer"
      >
        <div
          class="legend"
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
      </footer>
    </section>

    <section
      class="card day-details"
      id="day-details"
    >
      <header
        class="details-header"
      >
        <div>
          <h2>
            Day Details
          </h2>

          <div
            class="details-date"
            id="details-date"
          >
            Select a day
          </div>
        </div>
      </header>

      <div
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
            id="details-coding-time"
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
            Sessions
          </div>

          <div
            class="summary-value"
            id="details-session-count"
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
            Projects
          </div>

          <div
            class="summary-value"
            id="details-project-count"
          >
            0
          </div>
        </article>
      </div>

      <div
        class="details-grid"
      >
        <section
          class="detail-section"
        >
          <h3>
            Projects
          </h3>

          <div
            class="detail-list"
            id="project-list"
          ></div>
        </section>

        <section
          class="detail-section"
        >
          <h3>
            Languages
          </h3>

          <div
            class="detail-list"
            id="language-list"
          ></div>
        </section>

        <section
          class="detail-section"
        >
          <h3>
            Files
          </h3>

          <div
            class="detail-list"
            id="file-list"
          ></div>
        </section>
      </div>

      <section
        class="detail-section"
      >
        <h3>
          Sessions
        </h3>

        <div
          class="detail-list sessions"
          id="session-list"
        ></div>
      </section>
    </section>
  </main>

  <div
    class="tooltip"
    id="tooltip"
    role="tooltip"
  ></div>

  <script
    nonce="${nonce}"
  >
    const vscode =
      acquireVsCodeApi();

    const heatmap =
      document.getElementById(
        "heatmap"
      );

    const heatmapScroll =
      document.getElementById(
        "heatmap-scroll"
      );

    const months =
      document.getElementById(
        "months"
      );

    const tooltip =
      document.getElementById(
        "tooltip"
      );

    const detailsDate =
      document.getElementById(
        "details-date"
      );

    const detailsCodingTime =
      document.getElementById(
        "details-coding-time"
      );

    const detailsSessionCount =
      document.getElementById(
        "details-session-count"
      );

    const detailsProjectCount =
      document.getElementById(
        "details-project-count"
      );

    const projectList =
      document.getElementById(
        "project-list"
      );

    const languageList =
      document.getElementById(
        "language-list"
      );

    const fileList =
      document.getElementById(
        "file-list"
      );

    const sessionList =
      document.getElementById(
        "session-list"
      );

    let panelData =
      undefined;

    let selectedDate =
      undefined;

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

        panelData =
          message.data;

        if (
          !selectedDate ||
          !panelData.days[
            selectedDate
          ]
        ) {
          selectedDate =
            panelData.today;
        }

        renderHeatmap(
          panelData.activity
        );

        renderDayDetails(
          selectedDate
        );
      },
    );

    function renderHeatmap(
      points
    ) {
      const previousScrollLeft =
        heatmapScroll.scrollLeft;

      heatmap.replaceChildren();
      months.replaceChildren();

      if (
        !points ||
        points.length === 0
      ) {
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
          "placeholder";

        heatmap.appendChild(
          placeholder
        );
      }

      const values =
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
          ...values,
          1
        );

      points.forEach(
        (
          point,
          index
        ) => {
          const cell =
            document.createElement(
              "button"
            );

          cell.type =
            "button";

          cell.className =
            "cell level-" +
            heatLevel(
              point.activeMilliseconds,
              max
            );

          cell.dataset.date =
            point.date;

          cell.setAttribute(
            "aria-label",
            formatDate(
              point.date
            ) +
            ", " +
            formatDuration(
              point.activeMilliseconds
            )
          );

          if (
            point.date ===
            selectedDate
          ) {
            cell.classList.add(
              "selected"
            );
          }

          cell.addEventListener(
            "click",
            () => {
              selectedDate =
                point.date;

              updateSelectedCell();

              renderDayDetails(
                point.date
              );
            },
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
              ) +
              "\\nClick for details"
          );

          heatmap.appendChild(
            cell
          );

          const current =
            parseDateKey(
              point.date
            );

          const previous =
            index > 0
              ? parseDateKey(
                  points[
                    index - 1
                  ].date
                )
              : undefined;

          if (
            !previous ||
            current.getMonth() !==
              previous.getMonth()
          ) {
            const absoluteCellIndex =
              leadingDays +
              index;

            const weekIndex =
              Math.floor(
                absoluteCellIndex /
                7
              );

            const label =
              document.createElement(
                "span"
              );

            label.className =
              "month-label";

            label.textContent =
              current.toLocaleDateString(
                undefined,
                {
                  month:
                    "short",
                }
              );

            label.style.left =
              (
                weekIndex *
                15
              ) +
              "px";

            months.appendChild(
              label
            );
          }
        },
      );

      requestAnimationFrame(
        () => {
          if (
            previousScrollLeft > 0
          ) {
            heatmapScroll.scrollLeft =
              previousScrollLeft;
          } else {
            heatmapScroll.scrollLeft =
              heatmapScroll.scrollWidth;
          }
        },
      );
    }

    function updateSelectedCell() {
      for (
        const cell
        of heatmap.querySelectorAll(
          ".cell"
        )
      ) {
        cell.classList.toggle(
          "selected",
          cell.dataset.date ===
            selectedDate
        );
      }
    }

    function renderDayDetails(
      date
    ) {
      if (
        !panelData
      ) {
        return;
      }

      const detail =
        panelData.days[
          date
        ];

      if (
        !detail
      ) {
        return;
      }

      detailsDate.textContent =
        formatLongDate(
          detail.date
        );

      detailsCodingTime.textContent =
        formatDuration(
          detail.activeMilliseconds
        );

      detailsSessionCount.textContent =
        String(
          detail.sessions.length
        );

      detailsProjectCount.textContent =
        String(
          detail.projects.length
        );

      renderDimensionList(
        projectList,
        detail.projects,
        false
      );

      renderDimensionList(
        languageList,
        detail.languages,
        false
      );

      renderDimensionList(
        fileList,
        detail.files,
        true
      );

      renderSessions(
        detail.sessions
      );
    }

    function renderDimensionList(
      container,
      entries,
      useFileName
    ) {
      container.replaceChildren();

      if (
        entries.length ===
        0
      ) {
        container.innerHTML =
          '<div class="empty">No activity</div>';

        return;
      }

      for (
        const entry
        of entries.slice(
          0,
          8
        )
      ) {
        const item =
          document.createElement(
            "div"
          );

        item.className =
          "detail-item";

        const name =
          document.createElement(
            "div"
          );

        name.className =
          "detail-name";

        name.textContent =
          useFileName
            ? fileName(
                entry.name
              )
            : entry.name;

        if (
          useFileName
        ) {
          name.title =
            entry.name;

          item.classList.add(
            "clickable"
          );

          item.tabIndex =
            0;

          item.setAttribute(
            "role",
            "button"
          );

          item.setAttribute(
            "aria-label",
            "Open " +
            fileName(
              entry.name
            )
          );

          const openFile =
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
            openFile
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

                openFile();
              }
            },
          );
        }

        const value =
          document.createElement(
            "div"
          );

        value.className =
          "detail-value";

        value.textContent =
          formatDuration(
            entry.activeMilliseconds
          ) +
          " • " +
          formatPercentage(
            entry.percentage
          );

        item.append(
          name,
          value
        );

        container.appendChild(
          item
        );
      }
    }

    function renderSessions(
      sessions
    ) {
      sessionList.replaceChildren();

      if (
        sessions.length ===
        0
      ) {
        sessionList.innerHTML =
          '<div class="empty">No sessions</div>';

        return;
      }

      for (
        const session
        of sessions
      ) {
        const item =
          document.createElement(
            "div"
          );

        item.className =
          "session-item";

        const project =
          document.createElement(
            "div"
          );

        project.className =
          "session-project";

        project.textContent =
          session.projectName ??
          session.workspaceName ??
          "Unknown project";

        const time =
          document.createElement(
            "div"
          );

        time.className =
          "session-time";

        time.textContent =
          formatSessionTime(
            session.startedAt,
            session.endedAt
          );

        const duration =
          document.createElement(
            "div"
          );

        duration.className =
          "session-duration";

        duration.textContent =
          formatDuration(
            session.activeMilliseconds
          );

        item.append(
          project,
          time,
          duration
        );

        sessionList.appendChild(
          item
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
        value > 0 &&
        value < 1
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

    function formatDate(
      date
    ) {
      return parseDateKey(
        date
      ).toLocaleDateString(
        undefined,
        {
          weekday:
            "short",

          month:
            "short",

          day:
            "numeric",

          year:
            "numeric",
        }
      );
    }

    function formatLongDate(
      date
    ) {
      return parseDateKey(
        date
      ).toLocaleDateString(
        undefined,
        {
          weekday:
            "long",

          month:
            "long",

          day:
            "numeric",

          year:
            "numeric",
        }
      );
    }

    function formatSessionTime(
      startedAt,
      endedAt
    ) {
      const started =
        new Date(
          startedAt
        );

      const start =
        started.toLocaleTimeString(
          undefined,
          {
            hour:
              "2-digit",

            minute:
              "2-digit",
          }
        );

      if (
        !endedAt
      ) {
        return (
          start +
          " – Active"
        );
      }

      const end =
        new Date(
          endedAt
        ).toLocaleTimeString(
          undefined,
          {
            hour:
              "2-digit",

            minute:
              "2-digit",
          }
        );

      return (
        start +
        " – " +
        end
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

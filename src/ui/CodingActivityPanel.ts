import * as vscode from "vscode";

import { StatisticsService } from "../statistics/StatisticsService";
import { DailyActivityPoint } from "../types/StatisticsTypes";
import { ActivityTracker } from "../tracking/ActivityTracker";

const ACTIVITY_DAY_COUNT =
  365;

const PANEL_REFRESH_INTERVAL_MS =
  30_000;

interface CodingActivityData {
  activity:
    DailyActivityPoint[];
}

interface PanelMessage {
  type?:
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

    const data:
      CodingActivityData = {
      activity:
        this.statisticsService
          .getCalendarActivity(
            history,
            ACTIVITY_DAY_COUNT,
          ),
    };

    await this.panel.webview
      .postMessage({
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

    h1 {
      margin:
        0;

      font-size:
        22px;

      font-weight:
        600;
    }

    .subtitle {
      margin-top:
        5px;

      color:
        var(
          --vscode-descriptionForeground
        );
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

      border-radius:
        2px;

      background:
        var(
          --vscode-charts-blue
        );

      cursor:
        default;
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
        700px
    ) {
      body {
        padding:
          16px;
      }

      .header {
        align-items:
          flex-start;

        flex-direction:
          column;
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

        render(
          message.data.activity
        );
      },
    );

    function render(
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
              "div"
            );

          cell.className =
            "cell level-" +
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

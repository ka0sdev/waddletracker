import assert from "node:assert/strict";
import test from "node:test";

import { StatisticsService } from "../src/statistics/StatisticsService";

import {
  createEmptyDailyStats,
  DailyStats,
} from "../src/types/TrackerState";

function formatLocalDate(
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

function dateKey(
  offsetDays:
    number,
): string {
  const date =
    new Date();

  date.setHours(
    12,
    0,
    0,
    0,
  );

  date.setDate(
    date.getDate() +
    offsetDays,
  );

  return formatLocalDate(
    date,
  );
}

function createDay(
  offsetDays:
    number,

  milliseconds:
    number,
): DailyStats {
  const day =
    createEmptyDailyStats(
      dateKey(
        offsetDays,
      ),
    );

  day.activeMilliseconds =
    milliseconds;

  return day;
}

test(
  "StatisticsService aggregates totals, dimensions, active days and best day",
  () => {
    const service =
      new StatisticsService();

    const first =
      createDay(
        -1,
        60_000,
      );

    first.projects.alpha = {
      activeMilliseconds:
        60_000,
    };

    first.languages.typescript = {
      activeMilliseconds:
        60_000,
    };

    const second =
      createDay(
        0,
        120_000,
      );

    second.projects.beta = {
      activeMilliseconds:
        90_000,
    };

    second.projects.alpha = {
      activeMilliseconds:
        30_000,
    };

    second.languages.typescript = {
      activeMilliseconds:
        30_000,
    };

    second.languages.json = {
      activeMilliseconds:
        90_000,
    };

    const result =
      service.getStatistics(
        [
          first,
          second,
        ],
        "7days",
      );

    assert.equal(
      result.activeMilliseconds,
      180_000,
    );

    assert.equal(
      result.activeDays,
      2,
    );

    assert.equal(
      result.averageActiveMilliseconds,
      90_000,
    );

    assert.deepEqual(
      result.bestDay,
      {
        date:
          second.date,

        activeMilliseconds:
          120_000,
      },
    );

    assert.equal(
      result.projects[0].name,
      "alpha",
    );

    assert.equal(
      result.projects[0].activeMilliseconds,
      90_000,
    );

    assert.equal(
      Math.round(
        result.projects[0].percentage,
      ),
      50,
    );

    const typescript =
      result.languages.find(
        (entry) =>
          entry.name ===
          "typescript",
      );

    const json =
      result.languages.find(
        (entry) =>
          entry.name ===
          "json",
      );

    assert.ok(
      typescript,
    );

    assert.ok(
      json,
    );

    assert.equal(
      typescript.activeMilliseconds,
      90_000,
    );

    assert.equal(
      json.activeMilliseconds,
      90_000,
    );

    assert.equal(
      Math.round(
        typescript.percentage,
      ),
      50,
    );

    assert.equal(
      Math.round(
        json.percentage,
      ),
      50,
    );

    assert.equal(
      result.daily.length,
      7,
    );

    assert.equal(
      result.daily.at(
        -1,
      )?.date,
      dateKey(
        0,
      ),
    );
  },
);

test(
  "StatisticsService fills missing calendar days with zero activity",
  () => {
    const service =
      new StatisticsService();

    const activity =
      service.getCalendarActivity(
        [
          createDay(
            -2,
            60_000,
          ),

          createDay(
            0,
            120_000,
          ),
        ],
        3,
      );

    assert.deepEqual(
      activity,
      [
        {
          date:
            dateKey(
              -2,
            ),

          activeMilliseconds:
            60_000,
        },

        {
          date:
            dateKey(
              -1,
            ),

          activeMilliseconds:
            0,
        },

        {
          date:
            dateKey(
              0,
            ),

          activeMilliseconds:
            120_000,
        },
      ],
    );
  },
);

test(
  "StatisticsService keeps yesterday's streak current until a full day is missed",
  () => {
    const service =
      new StatisticsService();

    const streak =
      service.getStreakStatistics(
        [
          createDay(
            -3,
            60_000,
          ),

          createDay(
            -2,
            60_000,
          ),

          createDay(
            -1,
            60_000,
          ),
        ],
      );

    assert.equal(
      streak.currentDays,
      3,
    );

    assert.equal(
      streak.currentStartDate,
      dateKey(
        -3,
      ),
    );

    assert.equal(
      streak.currentEndDate,
      dateKey(
        -1,
      ),
    );

    assert.equal(
      streak.longestDays,
      3,
    );
  },
);

test(
  "StatisticsService breaks the current streak after a fully missed day",
  () => {
    const service =
      new StatisticsService();

    const streak =
      service.getStreakStatistics(
        [
          createDay(
            -4,
            60_000,
          ),

          createDay(
            -3,
            60_000,
          ),

          createDay(
            -2,
            60_000,
          ),
        ],
      );

    assert.equal(
      streak.currentDays,
      0,
    );

    assert.equal(
      streak.longestDays,
      3,
    );
  },
);

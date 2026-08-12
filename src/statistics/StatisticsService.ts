import {
  DailyDimensionStats,
  DailyStats,
} from "../types/TrackerState";

import {
  BestDayStatistics,
  DailyActivityPoint,
  HistoricalStatistics,
  StatisticsDimension,
  StatisticsRange,
  StreakStatistics,
} from "../types/StatisticsTypes";

interface DateRange {
  startDate: string;
  endDate: string;
}

export class StatisticsService {
  public getStatistics(
    dailyStats: readonly DailyStats[],
    range: StatisticsRange,
  ): HistoricalStatistics {
    const bounds =
      this.getRangeBounds(
        dailyStats,
        range,
      );

    const selectedDays =
      bounds
        ? this.selectDays(
            dailyStats,
            bounds,
          )
        : [];

    const activeMilliseconds =
      selectedDays.reduce(
        (
          total,
          day,
        ) =>
          total +
          day.activeMilliseconds,
        0,
      );

    const activeDays =
      selectedDays.filter(
        (day) =>
          day.activeMilliseconds > 0,
      ).length;

    const averageActiveMilliseconds =
      activeDays > 0
        ? activeMilliseconds /
          activeDays
        : 0;

    const projects =
      this.aggregateDimensions(
        selectedDays,
        (day) =>
          day.projects,
        activeMilliseconds,
      );

    const languages =
      this.aggregateDimensions(
        selectedDays,
        (day) =>
          day.languages,
        activeMilliseconds,
      );

    const files =
      this.aggregateDimensions(
        selectedDays,
        (day) =>
          day.files,
        activeMilliseconds,
      );

    const daily =
      bounds
        ? this.buildDailySeries(
            dailyStats,
            bounds.startDate,
            bounds.endDate,
          )
        : [];

    return {
      range,

      startDate:
        bounds?.startDate,

      endDate:
        bounds?.endDate,

      activeMilliseconds,

      activeDays,

      averageActiveMilliseconds,

      bestDay:
        this.getBestDay(
          selectedDays,
        ),

      projects,

      languages,

      files,

      daily,
    };
  }

  public getCalendarActivity(
    dailyStats: readonly DailyStats[],
    dayCount = 365,
  ): DailyActivityPoint[] {
    const safeDayCount =
      Math.max(
        1,
        Math.min(
          dayCount,
          3660,
        ),
      );

    const today =
      this.getLocalDateKey();

    const startDate =
      this.shiftLocalDate(
        today,
        -(safeDayCount - 1),
      );

    return this.buildDailySeries(
      dailyStats,
      startDate,
      today,
    );
  }

  public getStreakStatistics(
    dailyStats: readonly DailyStats[],
  ): StreakStatistics {
    const today =
      this.getLocalDateKey();

    const activeDates =
      dailyStats
        .filter(
          (day) =>
            day.activeMilliseconds >
              0 &&
            day.date <= today,
        )
        .map(
          (day) =>
            day.date,
        )
        .sort(
          (
            first,
            second,
          ) =>
            first.localeCompare(
              second,
            ),
        );

    if (
      activeDates.length === 0
    ) {
      return {
        currentDays: 0,
        longestDays: 0,

        currentStartDate:
          undefined,

        currentEndDate:
          undefined,

        longestStartDate:
          undefined,

        longestEndDate:
          undefined,
      };
    }

    const activeDateSet =
      new Set(
        activeDates,
      );

    const current =
      this.getCurrentStreak(
        activeDateSet,
        today,
      );

    const longest =
      this.getLongestStreak(
        activeDates,
      );

    return {
      currentDays:
        current.days,

      longestDays:
        longest.days,

      currentStartDate:
        current.startDate,

      currentEndDate:
        current.endDate,

      longestStartDate:
        longest.startDate,

      longestEndDate:
        longest.endDate,
    };
  }

  private getRangeBounds(
    dailyStats: readonly DailyStats[],
    range: StatisticsRange,
  ):
    | DateRange
    | undefined {
    const today =
      this.getLocalDateKey();

    if (
      range === "today"
    ) {
      return {
        startDate:
          today,

        endDate:
          today,
      };
    }

    if (
      range === "7days"
    ) {
      return {
        startDate:
          this.shiftLocalDate(
            today,
            -6,
          ),

        endDate:
          today,
      };
    }

    if (
      range === "30days"
    ) {
      return {
        startDate:
          this.shiftLocalDate(
            today,
            -29,
          ),

        endDate:
          today,
      };
    }

    const validDates =
      dailyStats
        .filter(
          (day) =>
            day.date <= today,
        )
        .map(
          (day) =>
            day.date,
        )
        .sort(
          (
            first,
            second,
          ) =>
            first.localeCompare(
              second,
            ),
        );

    const firstDate =
      validDates.at(
        0,
      );

    if (!firstDate) {
      return undefined;
    }

    return {
      startDate:
        firstDate,

      endDate:
        today,
    };
  }

  private selectDays(
    dailyStats: readonly DailyStats[],
    range: DateRange,
  ): DailyStats[] {
    return [...dailyStats]
      .filter(
        (day) =>
          day.date >=
            range.startDate &&
          day.date <=
            range.endDate,
      )
      .sort(
        (
          first,
          second,
        ) =>
          first.date.localeCompare(
            second.date,
          ),
      );
  }

  private buildDailySeries(
    dailyStats: readonly DailyStats[],
    startDate: string,
    endDate: string,
  ): DailyActivityPoint[] {
    const lookup =
      new Map<
        string,
        number
      >();

    for (
      const day
      of dailyStats
    ) {
      lookup.set(
        day.date,
        day.activeMilliseconds,
      );
    }

    const result:
      DailyActivityPoint[] = [];

    let currentDate =
      startDate;

    while (
      currentDate <=
      endDate
    ) {
      result.push({
        date:
          currentDate,

        activeMilliseconds:
          lookup.get(
            currentDate,
          ) ?? 0,
      });

      currentDate =
        this.shiftLocalDate(
          currentDate,
          1,
        );
    }

    return result;
  }

  private aggregateDimensions(
    days: readonly DailyStats[],
    selector: (
      day: DailyStats,
    ) => Record<
      string,
      DailyDimensionStats
    >,
    totalMilliseconds: number,
  ): StatisticsDimension[] {
    const totals =
      new Map<
        string,
        number
      >();

    for (
      const day
      of days
    ) {
      const dimensions =
        selector(
          day,
        );

      for (
        const [
          name,
          statistics,
        ]
        of Object.entries(
          dimensions,
        )
      ) {
        totals.set(
          name,
          (
            totals.get(
              name,
            ) ?? 0
          ) +
            statistics.activeMilliseconds,
        );
      }
    }

    return [
      ...totals.entries(),
    ]
      .sort(
        (
          [, first],
          [, second],
        ) =>
          second -
          first,
      )
      .map(
        (
          [
            name,
            milliseconds,
          ],
        ): StatisticsDimension => ({
          name,

          activeMilliseconds:
            milliseconds,

          percentage:
            totalMilliseconds > 0
              ? (
                  milliseconds /
                  totalMilliseconds
                ) *
                100
              : 0,
        }),
      );
  }

  private getBestDay(
    days: readonly DailyStats[],
  ):
    | BestDayStatistics
    | undefined {
    let bestDay:
      DailyStats | undefined;

    for (
      const day
      of days
    ) {
      if (
        day.activeMilliseconds <= 0
      ) {
        continue;
      }

      if (
        !bestDay ||
        day.activeMilliseconds >
          bestDay.activeMilliseconds
      ) {
        bestDay =
          day;
      }
    }

    if (!bestDay) {
      return undefined;
    }

    return {
      date:
        bestDay.date,

      activeMilliseconds:
        bestDay.activeMilliseconds,
    };
  }

  private getCurrentStreak(
    activeDates:
      ReadonlySet<string>,
    today: string,
  ): {
    days: number;

    startDate:
      | string
      | undefined;

    endDate:
      | string
      | undefined;
  } {
    let endDate:
      | string
      | undefined;

    if (
      activeDates.has(
        today,
      )
    ) {
      endDate =
        today;
    } else {
      const yesterday =
        this.shiftLocalDate(
          today,
          -1,
        );

      if (
        activeDates.has(
          yesterday,
        )
      ) {
        endDate =
          yesterday;
      }
    }

    if (!endDate) {
      return {
        days: 0,

        startDate:
          undefined,

        endDate:
          undefined,
      };
    }

    let days = 0;

    let cursor =
      endDate;

    let startDate =
      endDate;

    while (
      activeDates.has(
        cursor,
      )
    ) {
      days += 1;

      startDate =
        cursor;

      cursor =
        this.shiftLocalDate(
          cursor,
          -1,
        );
    }

    return {
      days,

      startDate,

      endDate,
    };
  }

  private getLongestStreak(
    activeDates:
      readonly string[],
  ): {
    days: number;

    startDate:
      | string
      | undefined;

    endDate:
      | string
      | undefined;
  } {
    if (
      activeDates.length === 0
    ) {
      return {
        days: 0,

        startDate:
          undefined,

        endDate:
          undefined,
      };
    }

    let longestDays =
      1;

    let longestStart =
      activeDates[0];

    let longestEnd =
      activeDates[0];

    let currentDays =
      1;

    let currentStart =
      activeDates[0];

    let previousDate =
      activeDates[0];

    for (
      let index = 1;
      index <
      activeDates.length;
      index += 1
    ) {
      const currentDate =
        activeDates[index];

      const expectedDate =
        this.shiftLocalDate(
          previousDate,
          1,
        );

      if (
        currentDate ===
        expectedDate
      ) {
        currentDays +=
          1;
      } else if (
        currentDate !==
        previousDate
      ) {
        currentDays =
          1;

        currentStart =
          currentDate;
      }

      if (
        currentDays >
        longestDays
      ) {
        longestDays =
          currentDays;

        longestStart =
          currentStart;

        longestEnd =
          currentDate;
      }

      previousDate =
        currentDate;
    }

    return {
      days:
        longestDays,

      startDate:
        longestStart,

      endDate:
        longestEnd,
    };
  }

  private shiftLocalDate(
    date: string,
    days: number,
  ): string {
    const [
      year,
      month,
      day,
    ] =
      date
        .split("-")
        .map(Number);

    const value =
      new Date(
        year,
        month - 1,
        day,
      );

    value.setDate(
      value.getDate() +
        days,
    );

    return this.formatLocalDate(
      value,
    );
  }

  private getLocalDateKey():
    string {
    return this.formatLocalDate(
      new Date(),
    );
  }

  private formatLocalDate(
    date: Date,
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
}
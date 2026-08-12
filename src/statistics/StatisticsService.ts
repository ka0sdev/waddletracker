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
} from "../types/StatisticsTypes";

export class StatisticsService {
  public getStatistics(
    dailyStats: readonly DailyStats[],
    range: StatisticsRange,
  ): HistoricalStatistics {
    const selectedDays =
      this.selectRange(
        dailyStats,
        range,
      );

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
        (day) => day.projects,
        activeMilliseconds,
      );

    const languages =
      this.aggregateDimensions(
        selectedDays,
        (day) => day.languages,
        activeMilliseconds,
      );

    const files =
      this.aggregateDimensions(
        selectedDays,
        (day) => day.files,
        activeMilliseconds,
      );

    const daily =
      selectedDays.map(
        (
          day,
        ): DailyActivityPoint => ({
          date: day.date,

          activeMilliseconds:
            day.activeMilliseconds,
        }),
      );

    return {
      range,

      startDate:
        selectedDays.at(0)?.date,

      endDate:
        selectedDays.at(-1)?.date,

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

  private selectRange(
    dailyStats: readonly DailyStats[],
    range: StatisticsRange,
  ): DailyStats[] {
    const sorted =
      [...dailyStats].sort(
        (first, second) =>
          first.date.localeCompare(
            second.date,
          ),
      );

    if (
      range === "all"
    ) {
      return sorted;
    }

    const today =
      this.getLocalDateKey();

    if (
      range === "today"
    ) {
      return sorted.filter(
        (day) =>
          day.date === today,
      );
    }

    const dayCount =
      range === "7days"
        ? 7
        : 30;

    const earliestDate =
      this.shiftLocalDate(
        today,
        -(dayCount - 1),
      );

    return sorted.filter(
      (day) =>
        day.date >= earliestDate &&
        day.date <= today,
    );
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
          [name, milliseconds],
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

  private getLocalDateKey(): string {
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
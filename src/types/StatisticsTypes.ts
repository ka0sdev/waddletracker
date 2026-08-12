export type StatisticsRange =
  | "today"
  | "7days"
  | "30days"
  | "all";

export interface StatisticsDimension {
  name: string;
  activeMilliseconds: number;
  percentage: number;
}

export interface DailyActivityPoint {
  date: string;
  activeMilliseconds: number;
}

export interface BestDayStatistics {
  date: string;
  activeMilliseconds: number;
}

export interface StreakStatistics {
  currentDays: number;
  longestDays: number;

  currentStartDate:
    | string
    | undefined;

  currentEndDate:
    | string
    | undefined;

  longestStartDate:
    | string
    | undefined;

  longestEndDate:
    | string
    | undefined;
}

export interface HistoricalStatistics {
  range: StatisticsRange;

  startDate:
    | string
    | undefined;

  endDate:
    | string
    | undefined;

  activeMilliseconds: number;

  activeDays: number;

  averageActiveMilliseconds: number;

  bestDay:
    | BestDayStatistics
    | undefined;

  projects: StatisticsDimension[];

  languages: StatisticsDimension[];

  files: StatisticsDimension[];

  daily: DailyActivityPoint[];
}
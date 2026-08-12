import { CodingSession } from "./CodingSession";

export interface DailyDimensionStats {
  activeMilliseconds: number;
}

export interface DailyStats {
  date: string;

  activeMilliseconds: number;

  projects: Record<
    string,
    DailyDimensionStats
  >;

  languages: Record<
    string,
    DailyDimensionStats
  >;

  files: Record<
    string,
    DailyDimensionStats
  >;
}

export interface TrackerState {
  version: 4;

  daily: Record<
    string,
    DailyStats
  >;

  sessions: CodingSession[];
}

export function createEmptyDailyStats(
  date: string,
): DailyStats {
  return {
    date,

    activeMilliseconds: 0,

    projects: {},
    languages: {},
    files: {},
  };
}

export function createEmptyTrackerState(): TrackerState {
  return {
    version: 4,

    daily: {},

    sessions: [],
  };
}
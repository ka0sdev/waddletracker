export interface DailyStats {
  date: string;
  activeMilliseconds: number;
}

export interface TrackerState {
  version: 1;
  daily: Record<string, DailyStats>;
}

export function createEmptyTrackerState(): TrackerState {
  return {
    version: 1,
    daily: {},
  };
}
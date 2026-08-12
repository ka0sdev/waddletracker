import { CodingSession } from "../types/CodingSession";

export interface SessionHistoryGroup {
  date: string;

  activeMilliseconds: number;

  sessions: CodingSession[];
}
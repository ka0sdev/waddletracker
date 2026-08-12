import * as fs from "node:fs/promises";
import * as path from "node:path";

import { CodingSession } from "../types/CodingSession";

import {
  createEmptyDailyStats,
  createEmptyTrackerState,
  DailyStats,
  TrackerState,
} from "../types/TrackerState";

import { StorageProvider } from "./StorageProvider";

interface LegacyDailyStatsV1 {
  date: string;
  activeMilliseconds: number;
}

interface LegacyTrackerStateV1 {
  version: 1;

  daily: Record<
    string,
    LegacyDailyStatsV1
  >;
}

interface LegacyTrackerStateV2 {
  version: 2;

  daily: Record<
    string,
    DailyStats
  >;
}

type LegacyCodingSessionV3 =
  Omit<
    CodingSession,
    "languages" | "files"
  >;

interface LegacyTrackerStateV3 {
  version: 3;

  daily: Record<
    string,
    DailyStats
  >;

  sessions:
    LegacyCodingSessionV3[];
}

export class JsonStorageProvider
  implements StorageProvider
{
  private readonly storageDirectory:
    string;

  private readonly stateFile:
    string;

  constructor(
    storageDirectory: string,
  ) {
    this.storageDirectory =
      storageDirectory;

    this.stateFile =
      path.join(
        storageDirectory,
        "waddletracker.json",
      );
  }

  public async initialize(): Promise<void> {
    await fs.mkdir(
      this.storageDirectory,
      {
        recursive: true,
      },
    );
  }

  public async loadState(): Promise<TrackerState> {
    try {
      const content =
        await fs.readFile(
          this.stateFile,
          "utf8",
        );

      const parsed =
        JSON.parse(
          content,
        ) as unknown;

      return this.parseState(
        parsed,
      );
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return createEmptyTrackerState();
      }

      throw error;
    }
  }

  public async saveState(
    state: TrackerState,
  ): Promise<void> {
    const temporaryFile =
      `${this.stateFile}.tmp`;

    const content =
      JSON.stringify(
        state,
        null,
        2,
      );

    await fs.writeFile(
      temporaryFile,
      content,
      "utf8",
    );

    await fs.rename(
      temporaryFile,
      this.stateFile,
    );
  }

  public async dispose(): Promise<void> {
    // Nothing to dispose for JSON storage.
  }

  private parseState(
    value: unknown,
  ): TrackerState {
    if (
      !value ||
      typeof value !== "object"
    ) {
      throw new Error(
        "Invalid WaddleTracker state.",
      );
    }

    const candidate =
      value as {
        version?: unknown;
        daily?: unknown;
        sessions?: unknown;
      };

    if (
      candidate.version === 4 &&
      candidate.daily &&
      typeof candidate.daily ===
        "object" &&
      Array.isArray(
        candidate.sessions,
      )
    ) {
      return value as TrackerState;
    }

    if (
      candidate.version === 3 &&
      candidate.daily &&
      typeof candidate.daily ===
        "object" &&
      Array.isArray(
        candidate.sessions,
      )
    ) {
      return this.migrateV3(
        value as LegacyTrackerStateV3,
      );
    }

    if (
      candidate.version === 2 &&
      candidate.daily &&
      typeof candidate.daily ===
        "object"
    ) {
      return this.migrateV2(
        value as LegacyTrackerStateV2,
      );
    }

    if (
      candidate.version === 1 &&
      candidate.daily &&
      typeof candidate.daily ===
        "object"
    ) {
      return this.migrateV1(
        value as LegacyTrackerStateV1,
      );
    }

    throw new Error(
      "Unsupported WaddleTracker state version.",
    );
  }

  private migrateV3(
    legacy: LegacyTrackerStateV3,
  ): TrackerState {
    return {
      version: 4,

      daily:
        legacy.daily,

      sessions:
        legacy.sessions.map(
          (
            session,
          ): CodingSession => ({
            ...session,

            languages: {},

            files: {},
          }),
        ),
    };
  }

  private migrateV2(
    legacy: LegacyTrackerStateV2,
  ): TrackerState {
    return {
      version: 4,

      daily:
        legacy.daily,

      sessions: [],
    };
  }

  private migrateV1(
    legacy: LegacyTrackerStateV1,
  ): TrackerState {
    const state =
      createEmptyTrackerState();

    for (
      const [
        date,
        legacyStats,
      ]
      of Object.entries(
        legacy.daily,
      )
    ) {
      const daily =
        createEmptyDailyStats(
          date,
        );

      daily.activeMilliseconds =
        legacyStats.activeMilliseconds;

      state.daily[date] =
        daily;
    }

    return state;
  }
}
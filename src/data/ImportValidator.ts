import {
  CodingSession,
  SessionDimensionStats,
} from "../types/CodingSession";

import {
  DailyDimensionStats,
  DailyStats,
  TrackerState,
} from "../types/TrackerState";

export const WADDLETRACKER_EXPORT_FORMAT =
  "waddletracker-export";

export const WADDLETRACKER_EXPORT_FORMAT_VERSION =
  1;

export interface WaddleTrackerExport {
  format:
    typeof WADDLETRACKER_EXPORT_FORMAT;

  formatVersion:
    typeof WADDLETRACKER_EXPORT_FORMAT_VERSION;

  exportedAt:
    string;

  trackerState:
    TrackerState;
}

export interface ImportSummary {
  exportedAt:
    string;

  activeDays:
    number;

  sessions:
    number;

  activeMilliseconds:
    number;
}

export interface ValidatedImport {
  state:
    TrackerState;

  summary:
    ImportSummary;
}

export class ImportValidator {
  public validate(
    value:
      unknown,
  ): ValidatedImport {
    const exportData =
      this.validateExport(
        value,
      );

    const normalizedState =
      this.normalizeImportedState(
        exportData.trackerState,
      );

    return {
      state:
        normalizedState,

      summary:
        this.createSummary(
          exportData.exportedAt,
          normalizedState,
        ),
    };
  }

  private validateExport(
    value:
      unknown,
  ): WaddleTrackerExport {
    if (
      !this.isRecord(
        value,
      )
    ) {
      throw new Error(
        "The selected file is not a WaddleTracker export.",
      );
    }

    if (
      value.format !==
      WADDLETRACKER_EXPORT_FORMAT
    ) {
      throw new Error(
        "Unsupported or missing WaddleTracker export format.",
      );
    }

    if (
      value.formatVersion !==
      WADDLETRACKER_EXPORT_FORMAT_VERSION
    ) {
      throw new Error(
        `Unsupported WaddleTracker export version "${String(
          value.formatVersion,
        )}".`,
      );
    }

    if (
      typeof value.exportedAt !==
        "string" ||
      !this.isValidDate(
        value.exportedAt,
      )
    ) {
      throw new Error(
        "The export does not contain a valid export timestamp.",
      );
    }

    return {
      format:
        WADDLETRACKER_EXPORT_FORMAT,

      formatVersion:
        WADDLETRACKER_EXPORT_FORMAT_VERSION,

      exportedAt:
        value.exportedAt,

      trackerState:
        this.validateTrackerState(
          value.trackerState,
        ),
    };
  }

  private validateTrackerState(
    value:
      unknown,
  ): TrackerState {
    if (
      !this.isRecord(
        value,
      )
    ) {
      throw new Error(
        "The export does not contain a valid tracker state.",
      );
    }

    if (
      value.version !==
      4
    ) {
      throw new Error(
        `Unsupported tracker-state version "${String(
          value.version,
        )}".`,
      );
    }

    if (
      !this.isRecord(
        value.daily,
      )
    ) {
      throw new Error(
        "The export contains invalid daily statistics.",
      );
    }

    if (
      !Array.isArray(
        value.sessions,
      )
    ) {
      throw new Error(
        "The export contains invalid coding-session history.",
      );
    }

    const daily:
      Record<
        string,
        DailyStats
      > = {};

    for (
      const [
        date,
        dayValue,
      ]
      of Object.entries(
        value.daily,
      )
    ) {
      daily[date] =
        this.validateDailyStats(
          date,
          dayValue,
        );
    }

    const sessions =
      value.sessions.map(
        (
          sessionValue,
          index,
        ) =>
          this.validateCodingSession(
            sessionValue,
            index,
          ),
      );

    return {
      version:
        4,

      daily,

      sessions,
    };
  }

  private validateDailyStats(
    key:
      string,

    value:
      unknown,
  ): DailyStats {
    if (
      !this.isRecord(
        value,
      )
    ) {
      throw new Error(
        `Invalid daily statistics for "${key}".`,
      );
    }

    if (
      typeof value.date !==
        "string" ||
      value.date !==
        key ||
      !this.isDateKey(
        value.date,
      )
    ) {
      throw new Error(
        `Invalid daily statistics date "${key}".`,
      );
    }

    return {
      date:
        value.date,

      activeMilliseconds:
        this.requireNonNegativeNumber(
          value.activeMilliseconds,
          `daily.${key}.activeMilliseconds`,
        ),

      projects:
        this.validateDimensionRecord(
          value.projects,
          `daily.${key}.projects`,
        ),

      languages:
        this.validateDimensionRecord(
          value.languages,
          `daily.${key}.languages`,
        ),

      files:
        this.validateDimensionRecord(
          value.files,
          `daily.${key}.files`,
        ),
    };
  }

  private validateCodingSession(
    value:
      unknown,

    index:
      number,
  ): CodingSession {
    if (
      !this.isRecord(
        value,
      )
    ) {
      throw new Error(
        `Invalid coding session at index ${index}.`,
      );
    }

    const id =
      this.requireString(
        value.id,
        `sessions[${index}].id`,
      );

    const startedAt =
      this.requireDateString(
        value.startedAt,
        `sessions[${index}].startedAt`,
      );

    const lastActivityAt =
      this.requireDateString(
        value.lastActivityAt,
        `sessions[${index}].lastActivityAt`,
      );

    let endedAt:
      string |
      undefined;

    if (
      value.endedAt !==
        undefined &&
      value.endedAt !==
        null
    ) {
      endedAt =
        this.requireDateString(
          value.endedAt,
          `sessions[${index}].endedAt`,
        );
    }

    return {
      id,

      startedAt,

      endedAt,

      lastActivityAt,

      activeMilliseconds:
        this.requireNonNegativeNumber(
          value.activeMilliseconds,
          `sessions[${index}].activeMilliseconds`,
        ),

      workspaceName:
        this.optionalString(
          value.workspaceName,
          `sessions[${index}].workspaceName`,
        ),

      projectName:
        this.optionalString(
          value.projectName,
          `sessions[${index}].projectName`,
        ),

      remoteName:
        this.optionalString(
          value.remoteName,
          `sessions[${index}].remoteName`,
        ),

      languages:
        this.validateSessionDimensionRecord(
          value.languages,
          `sessions[${index}].languages`,
        ),

      files:
        this.validateSessionDimensionRecord(
          value.files,
          `sessions[${index}].files`,
        ),
    };
  }

  private validateDimensionRecord(
    value:
      unknown,

    path:
      string,
  ): Record<
    string,
    DailyDimensionStats
  > {
    if (
      !this.isRecord(
        value,
      )
    ) {
      throw new Error(
        `Invalid statistics at "${path}".`,
      );
    }

    return Object.fromEntries(
      Object.entries(
        value,
      ).map(
        (
          [
            key,
            statistics,
          ],
        ) => [
          key,
          this.validateDimensionStats(
            statistics,
            `${path}.${key}`,
          ),
        ],
      ),
    );
  }

  private validateSessionDimensionRecord(
    value:
      unknown,

    path:
      string,
  ): Record<
    string,
    SessionDimensionStats
  > {
    if (
      !this.isRecord(
        value,
      )
    ) {
      throw new Error(
        `Invalid session statistics at "${path}".`,
      );
    }

    return Object.fromEntries(
      Object.entries(
        value,
      ).map(
        (
          [
            key,
            statistics,
          ],
        ) => [
          key,
          this.validateDimensionStats(
            statistics,
            `${path}.${key}`,
          ),
        ],
      ),
    );
  }

  private validateDimensionStats(
    value:
      unknown,

    path:
      string,
  ): {
    activeMilliseconds:
      number;
  } {
    if (
      !this.isRecord(
        value,
      )
    ) {
      throw new Error(
        `Invalid statistics at "${path}".`,
      );
    }

    return {
      activeMilliseconds:
        this.requireNonNegativeNumber(
          value.activeMilliseconds,
          `${path}.activeMilliseconds`,
        ),
    };
  }

  private normalizeImportedState(
    state:
      TrackerState,
  ): TrackerState {
    return {
      version:
        4,

      daily:
        Object.fromEntries(
          Object.entries(
            state.daily,
          ).map(
            (
              [
                date,
                day,
              ],
            ) => [
              date,
              {
                ...day,

                projects:
                  this.cloneDimensionRecord(
                    day.projects,
                  ),

                languages:
                  this.cloneDimensionRecord(
                    day.languages,
                  ),

                files:
                  this.cloneDimensionRecord(
                    day.files,
                  ),
              },
            ],
          ),
        ),

      sessions:
        state.sessions.map(
          (session) => ({
            ...session,

            endedAt:
              session.endedAt ??
              session.lastActivityAt,

            languages:
              this.cloneDimensionRecord(
                session.languages,
              ),

            files:
              this.cloneDimensionRecord(
                session.files,
              ),
          }),
        ),
    };
  }

  private createSummary(
    exportedAt:
      string,

    state:
      TrackerState,
  ): ImportSummary {
    const days =
      Object.values(
        state.daily,
      );

    return {
      exportedAt,

      activeDays:
        days.filter(
          (day) =>
            day.activeMilliseconds >
            0,
        ).length,

      sessions:
        state.sessions.length,

      activeMilliseconds:
        days.reduce(
          (
            total,
            day,
          ) =>
            total +
            day.activeMilliseconds,
          0,
        ),
    };
  }

  private cloneDimensionRecord<
    T extends {
      activeMilliseconds:
        number;
    },
  >(
    value:
      Record<
        string,
        T
      >,
  ): Record<
    string,
    T
  > {
    return Object.fromEntries(
      Object.entries(
        value,
      ).map(
        (
          [
            key,
            statistics,
          ],
        ) => [
          key,
          {
            ...statistics,
          },
        ],
      ),
    ) as Record<
      string,
      T
    >;
  }

  private isRecord(
    value:
      unknown,
  ): value is Record<
    string,
    unknown
  > {
    return (
      typeof value ===
        "object" &&
      value !==
        null &&
      !Array.isArray(
        value,
      )
    );
  }

  private isDateKey(
    value:
      string,
  ): boolean {
    if (
      !/^\d{4}-\d{2}-\d{2}$/
        .test(
          value,
        )
    ) {
      return false;
    }

    const [
      year,
      month,
      day,
    ] =
      value
        .split(
          "-",
        )
        .map(
          Number,
        );

    const date =
      new Date(
        year,
        month - 1,
        day,
      );

    return (
      date.getFullYear() ===
        year &&
      date.getMonth() ===
        month - 1 &&
      date.getDate() ===
        day
    );
  }

  private isValidDate(
    value:
      string,
  ): boolean {
    return (
      !Number.isNaN(
        new Date(
          value,
        ).getTime(),
      )
    );
  }

  private requireString(
    value:
      unknown,

    path:
      string,
  ): string {
    if (
      typeof value !==
        "string" ||
      value.length ===
        0
    ) {
      throw new Error(
        `Expected a non-empty string at "${path}".`,
      );
    }

    return value;
  }

  private optionalString(
    value:
      unknown,

    path:
      string,
  ): string | undefined {
    if (
      value ===
        undefined ||
      value ===
        null
    ) {
      return undefined;
    }

    if (
      typeof value !==
        "string"
    ) {
      throw new Error(
        `Expected a string at "${path}".`,
      );
    }

    return value;
  }

  private requireDateString(
    value:
      unknown,

    path:
      string,
  ): string {
    const result =
      this.requireString(
        value,
        path,
      );

    if (
      !this.isValidDate(
        result,
      )
    ) {
      throw new Error(
        `Expected a valid timestamp at "${path}".`,
      );
    }

    return result;
  }

  private requireNonNegativeNumber(
    value:
      unknown,

    path:
      string,
  ): number {
    if (
      typeof value !==
        "number" ||
      !Number.isFinite(
        value,
      ) ||
      value < 0
    ) {
      throw new Error(
        `Expected a non-negative number at "${path}".`,
      );
    }

    return value;
  }
}

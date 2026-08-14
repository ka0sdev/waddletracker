import * as fs from "node:fs/promises";
import * as path from "node:path";

import Database from "better-sqlite3";

import {
  CodingSession,
} from "../types/CodingSession";

import {
  createEmptyDailyStats,
  createEmptyTrackerState,
  DailyDimensionStats,
  TrackerState,
} from "../types/TrackerState";

import {
  StorageProvider,
} from "./StorageProvider";

const DATABASE_FILE_NAME =
  "waddletracker.sqlite3";

const DATABASE_SCHEMA_VERSION =
  1;

interface DailyStatsRow {
  date:
    string;

  active_milliseconds:
    number;
}

interface DailyDimensionRow {
  date:
    string;

  dimension_key:
    string;

  active_milliseconds:
    number;
}

interface SessionRow {
  id:
    string;

  sort_order:
    number;

  started_at:
    string;

  ended_at:
    string |
    null;

  last_activity_at:
    string;

  active_milliseconds:
    number;

  workspace_name:
    string |
    null;

  project_name:
    string |
    null;

  remote_name:
    string |
    null;
}

interface SessionDimensionRow {
  session_id:
    string;

  dimension_key:
    string;

  active_milliseconds:
    number;
}

export class SQLiteStorageProvider
  implements StorageProvider
{
  private readonly storageDirectory:
    string;

  private readonly databaseFile:
    string;

  private database:
    Database.Database |
    undefined;

  constructor(
    storageDirectory:
      string,
  ) {
    this.storageDirectory =
      storageDirectory;

    this.databaseFile =
      path.join(
        storageDirectory,
        DATABASE_FILE_NAME,
      );
  }

  public async initialize():
    Promise<void> {
    if (
      this.database
    ) {
      return;
    }

    await fs.mkdir(
      this.storageDirectory,
      {
        recursive:
          true,
      },
    );

    const database =
      new Database(
        this.databaseFile,
      );

    database.pragma(
      "foreign_keys = ON",
    );

    database.pragma(
      "journal_mode = WAL",
    );

    database.pragma(
      "synchronous = NORMAL",
    );

    this.database =
      database;

    try {
      this.initializeSchema(
        database,
      );
    } catch (
      error
    ) {
      database.close();

      this.database =
        undefined;

      throw error;
    }
  }

  public async loadState():
    Promise<TrackerState> {
    const database =
      this.requireDatabase();

    const state =
      createEmptyTrackerState();

    const dailyRows =
      database
        .prepare(
          `
            SELECT
              date,
              active_milliseconds
            FROM daily_stats
            ORDER BY date ASC
          `,
        )
        .all() as
        DailyStatsRow[];

    for (
      const row
      of dailyRows
    ) {
      const daily =
        createEmptyDailyStats(
          row.date,
        );

      daily.activeMilliseconds =
        row.active_milliseconds;

      state.daily[
        row.date
      ] =
        daily;
    }

    this.loadDailyDimensions(
      database,
      "daily_projects",
      state,
      "projects",
    );

    this.loadDailyDimensions(
      database,
      "daily_languages",
      state,
      "languages",
    );

    this.loadDailyDimensions(
      database,
      "daily_files",
      state,
      "files",
    );

    const sessionRows =
      database
        .prepare(
          `
            SELECT
              id,
              sort_order,
              started_at,
              ended_at,
              last_activity_at,
              active_milliseconds,
              workspace_name,
              project_name,
              remote_name
            FROM sessions
            ORDER BY sort_order ASC
          `,
        )
        .all() as
        SessionRow[];

    const sessionsById =
      new Map<
        string,
        CodingSession
      >();

    for (
      const row
      of sessionRows
    ) {
      const session:
        CodingSession = {
        id:
          row.id,

        startedAt:
          row.started_at,

        lastActivityAt:
          row.last_activity_at,

        activeMilliseconds:
          row.active_milliseconds,

        languages:
          {},

        files:
          {},

        ...(
          row.ended_at !==
          null
            ? {
                endedAt:
                  row.ended_at,
              }
            : {}
        ),

        ...(
          row.workspace_name !==
          null
            ? {
                workspaceName:
                  row.workspace_name,
              }
            : {}
        ),

        ...(
          row.project_name !==
          null
            ? {
                projectName:
                  row.project_name,
              }
            : {}
        ),

        ...(
          row.remote_name !==
          null
            ? {
                remoteName:
                  row.remote_name,
              }
            : {}
        ),
      };

      state.sessions.push(
        session,
      );

      sessionsById.set(
        session.id,
        session,
      );
    }

    this.loadSessionDimensions(
      database,
      "session_languages",
      sessionsById,
      "languages",
    );

    this.loadSessionDimensions(
      database,
      "session_files",
      sessionsById,
      "files",
    );

    return state;
  }

  public async saveState(
    state:
      TrackerState,
  ): Promise<void> {
    if (
      state.version !==
      4
    ) {
      throw new Error(
        `SQLiteStorageProvider only supports TrackerState version 4. Received version ${String(
          state.version,
        )}.`,
      );
    }

    const database =
      this.requireDatabase();

    const insertDaily =
      database.prepare(
        `
          INSERT INTO daily_stats (
            date,
            active_milliseconds
          )
          VALUES (?, ?)
        `,
      );

    const insertDailyProject =
      database.prepare(
        `
          INSERT INTO daily_projects (
            date,
            dimension_key,
            active_milliseconds
          )
          VALUES (?, ?, ?)
        `,
      );

    const insertDailyLanguage =
      database.prepare(
        `
          INSERT INTO daily_languages (
            date,
            dimension_key,
            active_milliseconds
          )
          VALUES (?, ?, ?)
        `,
      );

    const insertDailyFile =
      database.prepare(
        `
          INSERT INTO daily_files (
            date,
            dimension_key,
            active_milliseconds
          )
          VALUES (?, ?, ?)
        `,
      );

    const insertSession =
      database.prepare(
        `
          INSERT INTO sessions (
            id,
            sort_order,
            started_at,
            ended_at,
            last_activity_at,
            active_milliseconds,
            workspace_name,
            project_name,
            remote_name
          )
          VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?
          )
        `,
      );

    const insertSessionLanguage =
      database.prepare(
        `
          INSERT INTO session_languages (
            session_id,
            dimension_key,
            active_milliseconds
          )
          VALUES (?, ?, ?)
        `,
      );

    const insertSessionFile =
      database.prepare(
        `
          INSERT INTO session_files (
            session_id,
            dimension_key,
            active_milliseconds
          )
          VALUES (?, ?, ?)
        `,
      );

    const saveTransaction =
      database.transaction(
        () => {
          database.exec(
            `
              DELETE FROM daily_stats;
              DELETE FROM sessions;
            `,
          );

          for (
            const daily
            of Object.values(
              state.daily,
            )
          ) {
            insertDaily.run(
              daily.date,
              daily.activeMilliseconds,
            );

            this.saveDimensionRecord(
              daily.date,
              daily.projects,
              insertDailyProject,
            );

            this.saveDimensionRecord(
              daily.date,
              daily.languages,
              insertDailyLanguage,
            );

            this.saveDimensionRecord(
              daily.date,
              daily.files,
              insertDailyFile,
            );
          }

          state.sessions.forEach(
            (
              session,
              index,
            ) => {
              insertSession.run(
                session.id,
                index,
                session.startedAt,
                session.endedAt ??
                  null,
                session.lastActivityAt,
                session.activeMilliseconds,
                session.workspaceName ??
                  null,
                session.projectName ??
                  null,
                session.remoteName ??
                  null,
              );

              this.saveSessionDimensionRecord(
                session.id,
                session.languages,
                insertSessionLanguage,
              );

              this.saveSessionDimensionRecord(
                session.id,
                session.files,
                insertSessionFile,
              );
            },
          );
        },
      );

    saveTransaction();
  }

  public async dispose():
    Promise<void> {
    if (
      !this.database
    ) {
      return;
    }

    this.database.close();

    this.database =
      undefined;
  }

  private initializeSchema(
    database:
      Database.Database,
  ): void {
    const schemaVersion =
      database.pragma(
        "user_version",
        {
          simple:
            true,
        },
      ) as number;

    if (
      schemaVersion >
      DATABASE_SCHEMA_VERSION
    ) {
      throw new Error(
        `Unsupported WaddleTracker SQLite schema version ${String(
          schemaVersion,
        )}.`,
      );
    }

    if (
      schemaVersion ===
      DATABASE_SCHEMA_VERSION
    ) {
      return;
    }

    if (
      schemaVersion !==
      0
    ) {
      throw new Error(
        `WaddleTracker cannot migrate SQLite schema version ${String(
          schemaVersion,
        )} to ${String(
          DATABASE_SCHEMA_VERSION,
        )}.`,
      );
    }

    const migrate =
      database.transaction(
        () => {
          database.exec(
            `
              CREATE TABLE daily_stats (
                date TEXT PRIMARY KEY NOT NULL,
                active_milliseconds INTEGER NOT NULL
                  CHECK (active_milliseconds >= 0)
              );

              CREATE TABLE daily_projects (
                date TEXT NOT NULL,
                dimension_key TEXT NOT NULL,
                active_milliseconds INTEGER NOT NULL
                  CHECK (active_milliseconds >= 0),
                PRIMARY KEY (
                  date,
                  dimension_key
                ),
                FOREIGN KEY (date)
                  REFERENCES daily_stats(date)
                  ON DELETE CASCADE
              );

              CREATE TABLE daily_languages (
                date TEXT NOT NULL,
                dimension_key TEXT NOT NULL,
                active_milliseconds INTEGER NOT NULL
                  CHECK (active_milliseconds >= 0),
                PRIMARY KEY (
                  date,
                  dimension_key
                ),
                FOREIGN KEY (date)
                  REFERENCES daily_stats(date)
                  ON DELETE CASCADE
              );

              CREATE TABLE daily_files (
                date TEXT NOT NULL,
                dimension_key TEXT NOT NULL,
                active_milliseconds INTEGER NOT NULL
                  CHECK (active_milliseconds >= 0),
                PRIMARY KEY (
                  date,
                  dimension_key
                ),
                FOREIGN KEY (date)
                  REFERENCES daily_stats(date)
                  ON DELETE CASCADE
              );

              CREATE TABLE sessions (
                id TEXT PRIMARY KEY NOT NULL,
                sort_order INTEGER NOT NULL
                  CHECK (sort_order >= 0),
                started_at TEXT NOT NULL,
                ended_at TEXT,
                last_activity_at TEXT NOT NULL,
                active_milliseconds INTEGER NOT NULL
                  CHECK (active_milliseconds >= 0),
                workspace_name TEXT,
                project_name TEXT,
                remote_name TEXT
              );

              CREATE UNIQUE INDEX sessions_sort_order_index
                ON sessions(sort_order);

              CREATE INDEX sessions_started_at_index
                ON sessions(started_at);

              CREATE TABLE session_languages (
                session_id TEXT NOT NULL,
                dimension_key TEXT NOT NULL,
                active_milliseconds INTEGER NOT NULL
                  CHECK (active_milliseconds >= 0),
                PRIMARY KEY (
                  session_id,
                  dimension_key
                ),
                FOREIGN KEY (session_id)
                  REFERENCES sessions(id)
                  ON DELETE CASCADE
              );

              CREATE TABLE session_files (
                session_id TEXT NOT NULL,
                dimension_key TEXT NOT NULL,
                active_milliseconds INTEGER NOT NULL
                  CHECK (active_milliseconds >= 0),
                PRIMARY KEY (
                  session_id,
                  dimension_key
                ),
                FOREIGN KEY (session_id)
                  REFERENCES sessions(id)
                  ON DELETE CASCADE
              );

              CREATE INDEX session_files_session_id_index
                ON session_files(session_id);

              CREATE INDEX session_languages_session_id_index
                ON session_languages(session_id);
            `,
          );

          database.pragma(
            `user_version = ${DATABASE_SCHEMA_VERSION}`,
          );
        },
      );

    migrate();
  }

  private loadDailyDimensions(
    database:
      Database.Database,

    table:
      "daily_projects" |
      "daily_languages" |
      "daily_files",

    state:
      TrackerState,

    target:
      "projects" |
      "languages" |
      "files",
  ): void {
    const rows =
      database
        .prepare(
          `
            SELECT
              date,
              dimension_key,
              active_milliseconds
            FROM ${table}
            ORDER BY
              date ASC,
              dimension_key ASC
          `,
        )
        .all() as
        DailyDimensionRow[];

    for (
      const row
      of rows
    ) {
      const daily =
        state.daily[
          row.date
        ];

      if (
        !daily
      ) {
        throw new Error(
          `Invalid SQLite state: missing daily_stats row for ${row.date}.`,
        );
      }

      daily[
        target
      ][
        row.dimension_key
      ] = {
        activeMilliseconds:
          row.active_milliseconds,
      };
    }
  }

  private loadSessionDimensions(
    database:
      Database.Database,

    table:
      "session_languages" |
      "session_files",

    sessionsById:
      Map<
        string,
        CodingSession
      >,

    target:
      "languages" |
      "files",
  ): void {
    const rows =
      database
        .prepare(
          `
            SELECT
              session_id,
              dimension_key,
              active_milliseconds
            FROM ${table}
            ORDER BY
              session_id ASC,
              dimension_key ASC
          `,
        )
        .all() as
        SessionDimensionRow[];

    for (
      const row
      of rows
    ) {
      const session =
        sessionsById.get(
          row.session_id,
        );

      if (
        !session
      ) {
        throw new Error(
          `Invalid SQLite state: missing session row for ${row.session_id}.`,
        );
      }

      session[
        target
      ][
        row.dimension_key
      ] = {
        activeMilliseconds:
          row.active_milliseconds,
      };
    }
  }

  private saveDimensionRecord(
    date:
      string,

    collection:
      Record<
        string,
        DailyDimensionStats
      >,

    statement:
      Database.Statement,
  ): void {
    for (
      const [
        key,
        statistics,
      ]
      of Object.entries(
        collection,
      )
    ) {
      statement.run(
        date,
        key,
        statistics.activeMilliseconds,
      );
    }
  }

  private saveSessionDimensionRecord(
    sessionId:
      string,

    collection:
      Record<
        string,
        {
          activeMilliseconds:
            number;
        }
      >,

    statement:
      Database.Statement,
  ): void {
    for (
      const [
        key,
        statistics,
      ]
      of Object.entries(
        collection,
      )
    ) {
      statement.run(
        sessionId,
        key,
        statistics.activeMilliseconds,
      );
    }
  }

  private requireDatabase():
    Database.Database {
    if (
      !this.database
    ) {
      throw new Error(
        "SQLiteStorageProvider has not been initialized.",
      );
    }

    return this.database;
  }
}

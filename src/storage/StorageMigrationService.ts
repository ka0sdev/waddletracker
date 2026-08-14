import * as fs from "node:fs/promises";
import * as path from "node:path";
import { isDeepStrictEqual } from "node:util";

import {
  TrackerState,
} from "../types/TrackerState";

import {
  JsonStorageProvider,
} from "./JsonStorageProvider";

import {
  SQLiteStorageProvider,
} from "./SQLiteStorageProvider";

const JSON_FILE_NAME =
  "waddletracker.json";

const JSON_BACKUP_FILE_NAME =
  "waddletracker.json.backup";

export interface StorageMigrationResult {
  migrated:
    boolean;

  reason:
    "migrated" |
    "json-not-found" |
    "sqlite-already-exists";

  backupPath?:
    string;
}

export class StorageMigrationService {
  constructor(
    private readonly storageDirectory:
      string,
  ) {}

  public async migrateJsonToSQLite():
    Promise<StorageMigrationResult> {
    const jsonPath =
      path.join(
        this.storageDirectory,
        JSON_FILE_NAME,
      );

    const sqlitePath =
      path.join(
        this.storageDirectory,
        "waddletracker.sqlite3",
      );

    if (
      await this.pathExists(
        sqlitePath,
      )
    ) {
      return {
        migrated:
          false,

        reason:
          "sqlite-already-exists",
      };
    }

    if (
      !await this.pathExists(
        jsonPath,
      )
    ) {
      return {
        migrated:
          false,

        reason:
          "json-not-found",
      };
    }

    const jsonStorage =
      new JsonStorageProvider(
        this.storageDirectory,
      );

    const sqliteStorage =
      new SQLiteStorageProvider(
        this.storageDirectory,
      );

    try {
      await jsonStorage
        .initialize();

      const jsonState =
        await jsonStorage
          .loadState();

      await sqliteStorage
        .initialize();

      await sqliteStorage
        .saveState(
          jsonState,
        );

      const sqliteState =
        await sqliteStorage
          .loadState();

      this.assertEquivalent(
        jsonState,
        sqliteState,
      );

      const backupPath =
        await this.createBackup(
          jsonPath,
        );

      return {
        migrated:
          true,

        reason:
          "migrated",

        backupPath,
      };
    } catch (
      error
    ) {
      await sqliteStorage
        .dispose();

      await this.removeSQLiteFiles();

      throw error;
    } finally {
      await jsonStorage
        .dispose();

      await sqliteStorage
        .dispose();
    }
  }

  private async createBackup(
    jsonPath:
      string,
  ): Promise<string> {
    const backupPath =
      path.join(
        this.storageDirectory,
        JSON_BACKUP_FILE_NAME,
      );

    await fs.copyFile(
      jsonPath,
      backupPath,
    );

    return backupPath;
  }

  private assertEquivalent(
    expected:
      TrackerState,

    actual:
      TrackerState,
  ): void {
    if (
      !isDeepStrictEqual(
        expected,
        actual,
      )
    ) {
      throw new Error(
        "JSON to SQLite migration verification failed. The migrated state does not match the source state.",
      );
    }
  }

  private async removeSQLiteFiles():
    Promise<void> {
    const fileNames = [
      "waddletracker.sqlite3",
      "waddletracker.sqlite3-shm",
      "waddletracker.sqlite3-wal",
    ];

    await Promise.all(
      fileNames.map(
        async (
          fileName,
        ) => {
          await fs.rm(
            path.join(
              this.storageDirectory,
              fileName,
            ),
            {
              force:
                true,
            },
          );
        },
      ),
    );
  }

  private async pathExists(
    targetPath:
      string,
  ): Promise<boolean> {
    try {
      await fs.access(
        targetPath,
      );

      return true;
    } catch {
      return false;
    }
  }
}

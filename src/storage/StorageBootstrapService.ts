import {
  TrackerState,
} from "../types/TrackerState";

import {
  JsonStorageProvider,
} from "./JsonStorageProvider";

import {
  SQLiteStorageProvider,
} from "./SQLiteStorageProvider";

import {
  StorageMigrationResult,
  StorageMigrationService,
} from "./StorageMigrationService";

import {
  StorageProvider,
} from "./StorageProvider";

export type ActiveStorageProvider =
  | "sqlite"
  | "json";

export interface StorageBootstrapResult {
  storage:
    StorageProvider;

  state:
    TrackerState;

  provider:
    ActiveStorageProvider;

  migration:
    StorageMigrationResult |
    undefined;

  fallbackError:
    string |
    undefined;
}

export class StorageBootstrapService {
  constructor(
    private readonly storageDirectory:
      string,
  ) {}

  public async initialize():
    Promise<StorageBootstrapResult> {
    let migration:
      StorageMigrationResult |
      undefined;

    try {
      const migrationService =
        new StorageMigrationService(
          this.storageDirectory,
        );

      migration =
        await migrationService
          .migrateJsonToSQLite();
    } catch (
      error
    ) {
      return this.initializeJsonFallback(
        this.describeError(
          error,
          "SQLite migration failed.",
        ),
        undefined,
      );
    }

    const sqliteStorage =
      new SQLiteStorageProvider(
        this.storageDirectory,
      );

    try {
      await sqliteStorage
        .initialize();

      const state =
        await sqliteStorage
          .loadState();

      return {
        storage:
          sqliteStorage,

        state,

        provider:
          "sqlite",

        migration,

        fallbackError:
          undefined,
      };
    } catch (
      error
    ) {
      await sqliteStorage
        .dispose();

      return this.initializeJsonFallback(
        this.describeError(
          error,
          "SQLite initialization failed.",
        ),
        migration,
      );
    }
  }

  private async initializeJsonFallback(
    fallbackError:
      string,

    migration:
      StorageMigrationResult |
      undefined,
  ): Promise<StorageBootstrapResult> {
    const jsonStorage =
      new JsonStorageProvider(
        this.storageDirectory,
      );

    await jsonStorage
      .initialize();

    const state =
      await jsonStorage
        .loadState();

    return {
      storage:
        jsonStorage,

      state,

      provider:
        "json",

      migration,

      fallbackError,
    };
  }

  private describeError(
    error:
      unknown,

    prefix:
      string,
  ): string {
    if (
      error instanceof Error
    ) {
      return (
        `${prefix} ${error.message}`
      );
    }

    return prefix;
  }
}

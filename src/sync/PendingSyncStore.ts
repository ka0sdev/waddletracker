import * as fs from "node:fs/promises";
import * as path from "node:path";

import {
  SyncSnapshot,
} from "./SyncTypes";

const PENDING_SYNC_FILE =
  "pending-sync.json";

export interface PendingSyncRecord {
  snapshot:
    SyncSnapshot;

  queuedAt:
    string;

  attempts:
    number;

  lastAttemptAt?:
    string;

  lastError?:
    string;
}

export class PendingSyncStore {
  private readonly filePath:
    string;

  constructor(
    storageDirectory:
      string,
  ) {
    this.filePath =
      path.join(
        storageDirectory,
        PENDING_SYNC_FILE,
      );
  }

  public async initialize():
    Promise<void> {
    await fs.mkdir(
      path.dirname(
        this.filePath,
      ),
      {
        recursive:
          true,
      },
    );
  }

  public async load():
    Promise<
      PendingSyncRecord |
      undefined
    > {
    try {
      const content =
        await fs.readFile(
          this.filePath,
          "utf8",
        );

      const parsed =
        JSON.parse(
          content,
        ) as PendingSyncRecord;

      if (
        !parsed ||
        typeof parsed !==
          "object" ||
        !parsed.snapshot ||
        typeof parsed.queuedAt !==
          "string" ||
        typeof parsed.attempts !==
          "number"
      ) {
        throw new Error(
          "Pending sync data is invalid.",
        );
      }

      return parsed;
    } catch (
      error
    ) {
      if (
        this.isMissingFileError(
          error,
        )
      ) {
        return undefined;
      }

      throw error;
    }
  }

  public async replace(
    snapshot:
      SyncSnapshot,
  ): Promise<PendingSyncRecord> {
    const record:
      PendingSyncRecord = {
      snapshot,

      queuedAt:
        new Date()
          .toISOString(),

      attempts:
        0,
    };

    await this.write(
      record,
    );

    return record;
  }

  public async recordFailure(
    record:
      PendingSyncRecord,

    error:
      unknown,
  ): Promise<PendingSyncRecord> {
    const updated:
      PendingSyncRecord = {
      ...record,

      attempts:
        record.attempts +
        1,

      lastAttemptAt:
        new Date()
          .toISOString(),

      lastError:
        this.formatError(
          error,
        ),
    };

    await this.write(
      updated,
    );

    return updated;
  }

  public async clear():
    Promise<void> {
    try {
      await fs.unlink(
        this.filePath,
      );
    } catch (
      error
    ) {
      if (
        !this.isMissingFileError(
          error,
        )
      ) {
        throw error;
      }
    }
  }

  private async write(
    record:
      PendingSyncRecord,
  ): Promise<void> {
    const temporaryPath =
      `${this.filePath}.tmp`;

    await fs.writeFile(
      temporaryPath,
      JSON.stringify(
        record,
        null,
        2,
      ),
      "utf8",
    );

    await fs.rename(
      temporaryPath,
      this.filePath,
    );
  }

  private formatError(
    error:
      unknown,
  ): string {
    return error instanceof Error
      ? error.message
      : String(
          error,
        );
  }

  private isMissingFileError(
    error:
      unknown,
  ): boolean {
    return (
      error instanceof Error &&
      "code" in error &&
      error.code ===
        "ENOENT"
    );
  }
}

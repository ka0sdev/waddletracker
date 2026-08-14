import * as fs from "node:fs/promises";
import * as path from "node:path";

const SYNC_METADATA_FILE =
  "sync-metadata.json";

export type SyncFailureKind =
  | "transient"
  | "configuration"
  | "protocol"
  | "local";

export interface SyncMetadata {
  lastAttemptAt?:
    string;

  lastSuccessAt?:
    string;

  lastFailureAt?:
    string;

  lastError?:
    string;

  lastErrorKind?:
    SyncFailureKind;
}

export class SyncMetadataStore {
  private readonly filePath:
    string;

  constructor(
    storageDirectory:
      string,
  ) {
    this.filePath =
      path.join(
        storageDirectory,
        SYNC_METADATA_FILE,
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
    Promise<SyncMetadata> {
    try {
      const content =
        await fs.readFile(
          this.filePath,
          "utf8",
        );

      const parsed =
        JSON.parse(
          content,
        ) as unknown;

      if (
        !parsed ||
        typeof parsed !==
          "object"
      ) {
        return {};
      }

      return parsed as
        SyncMetadata;
    } catch (
      error
    ) {
      if (
        this.isMissingFileError(
          error,
        )
      ) {
        return {};
      }

      throw error;
    }
  }

  public async recordAttempt(
    timestamp =
      new Date()
        .toISOString(),
  ): Promise<SyncMetadata> {
    const metadata =
      await this.load();

    const updated:
      SyncMetadata = {
      ...metadata,

      lastAttemptAt:
        timestamp,
    };

    await this.write(
      updated,
    );

    return updated;
  }

  public async recordSuccess(
    timestamp:
      string,
  ): Promise<SyncMetadata> {
    const metadata =
      await this.load();

    const updated:
      SyncMetadata = {
      ...metadata,

      lastSuccessAt:
        timestamp,

      lastError:
        undefined,

      lastErrorKind:
        undefined,
    };

    await this.write(
      updated,
    );

    return updated;
  }

  public async recordFailure(
    kind:
      SyncFailureKind,

    error:
      unknown,

    timestamp =
      new Date()
        .toISOString(),
  ): Promise<SyncMetadata> {
    const metadata =
      await this.load();

    const updated:
      SyncMetadata = {
      ...metadata,

      lastFailureAt:
        timestamp,

      lastError:
        this.formatError(
          error,
        ),

      lastErrorKind:
        kind,
    };

    await this.write(
      updated,
    );

    return updated;
  }

  private async write(
    metadata:
      SyncMetadata,
  ): Promise<void> {
    const temporaryPath =
      `${this.filePath}.tmp`;

    await fs.writeFile(
      temporaryPath,
      JSON.stringify(
        metadata,
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

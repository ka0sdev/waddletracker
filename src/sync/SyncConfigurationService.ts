import {
  hostname,
} from "node:os";

import {
  randomUUID,
} from "node:crypto";

import * as vscode from "vscode";

import {
  SyncSource,
} from "./SyncTypes";

const SOURCE_ID_KEY =
  "waddletracker.sync.sourceId";

const SYNC_TOKEN_KEY =
  "waddletracker.sync.token";

export interface SyncConfiguration {
  enabled:
    boolean;

  endpoint:
    string;

  source:
    SyncSource;

  token:
    string |
    undefined;

  autoSync:
    boolean;

  intervalMinutes:
    number;
}

export class SyncConfigurationService {
  constructor(
    private readonly context:
      vscode.ExtensionContext,
  ) {}

  public async getConfiguration():
    Promise<SyncConfiguration> {
    const configuration =
      vscode.workspace
        .getConfiguration(
          "waddleTracker",
        );

    const enabled =
      configuration.get<boolean>(
        "sync.enabled",
        false,
      );

    const endpoint =
      configuration.get<string>(
        "sync.endpoint",
        "",
      ).trim();

    const configuredSourceName =
      configuration.get<string>(
        "sync.sourceName",
        "",
      ).trim();

    const autoSync =
      configuration.get<boolean>(
        "sync.autoSync",
        true,
      );

    const configuredInterval =
      configuration.get<number>(
        "sync.intervalMinutes",
        5,
      );

    const intervalMinutes =
      Math.min(
        1440,
        Math.max(
          1,
          Number.isFinite(
            configuredInterval,
          )
            ? configuredInterval
            : 5,
        ),
      );

    const sourceId =
      await this.getOrCreateSourceId();

    const token =
      await this.context.secrets
        .get(
          SYNC_TOKEN_KEY,
        );

    return {
      enabled,

      endpoint,

      source: {
        id:
          sourceId,

        name:
          configuredSourceName ||
          hostname() ||
          "WaddleTracker",

        platform:
          process.platform,

        ...(
          vscode.env.remoteName
            ? {
                remoteName:
                  vscode.env.remoteName,
              }
            : {}
        ),
      },

      token,

      autoSync,

      intervalMinutes,
    };
  }

  public async setToken(
    token:
      string,
  ): Promise<void> {
    const normalized =
      token.trim();

    if (
      normalized.length ===
      0
    ) {
      throw new Error(
        "Sync token cannot be empty.",
      );
    }

    await this.context.secrets
      .store(
        SYNC_TOKEN_KEY,
        normalized,
      );
  }

  public async clearToken():
    Promise<void> {
    await this.context.secrets
      .delete(
        SYNC_TOKEN_KEY,
      );
  }

  public async hasToken():
    Promise<boolean> {
    return Boolean(
      await this.context.secrets
        .get(
          SYNC_TOKEN_KEY,
        ),
    );
  }

  public async getSourceId():
    Promise<string> {
    return this.getOrCreateSourceId();
  }

  private async getOrCreateSourceId():
    Promise<string> {
    const existing =
      this.context.globalState
        .get<string>(
          SOURCE_ID_KEY,
        );

    if (
      existing
    ) {
      return existing;
    }

    const sourceId =
      randomUUID();

    await this.context.globalState
      .update(
        SOURCE_ID_KEY,
        sourceId,
      );

    return sourceId;
  }
}

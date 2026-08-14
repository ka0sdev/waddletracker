import {
  SyncProvider,
  SyncPushResult,
  SyncSnapshot,
} from "./SyncTypes";

const DEFAULT_TIMEOUT_MS =
  15_000;

export interface HttpSyncProviderOptions {
  endpoint:
    string;

  token?:
    string;

  timeoutMilliseconds?:
    number;
}

interface SyncResponseBody {
  accepted?:
    unknown;

  snapshotId?:
    unknown;

  receivedAt?:
    unknown;
}

export class HttpSyncProvider
  implements SyncProvider
{
  private readonly endpoint:
    string;

  private readonly token:
    string |
    undefined;

  private readonly timeoutMilliseconds:
    number;

  constructor(
    options:
      HttpSyncProviderOptions,
  ) {
    this.endpoint =
      this.normalizeEndpoint(
        options.endpoint,
      );

    this.token =
      options.token?.trim() ||
      undefined;

    this.timeoutMilliseconds =
      options.timeoutMilliseconds ??
      DEFAULT_TIMEOUT_MS;

    if (
      !Number.isFinite(
        this.timeoutMilliseconds,
      ) ||
      this.timeoutMilliseconds <=
        0
    ) {
      throw new Error(
        "Sync timeout must be a positive number.",
      );
    }
  }

  public async pushSnapshot(
    snapshot:
      SyncSnapshot,
  ): Promise<SyncPushResult> {
    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () => {
          controller.abort();
        },
        this.timeoutMilliseconds,
      );

    try {
      const response =
        await fetch(
          `${this.endpoint}/api/v1/sync/snapshots`,
          {
            method:
              "POST",

            headers:
              this.createHeaders(),

            body:
              JSON.stringify(
                snapshot,
              ),

            signal:
              controller.signal,
          },
        );

      const responseText =
        await response.text();

      if (
        !response.ok
      ) {
        const responseDetail =
          responseText.trim();

        const suffix =
          responseDetail.length >
          0
            ? ` ${this.truncate(
                responseDetail,
                300,
              )}`
            : "";

        throw new Error(
          `WaddleTracker sync failed with HTTP ${String(
            response.status,
          )}.${suffix}`,
        );
      }

      let body:
        SyncResponseBody;

      try {
        body =
          JSON.parse(
            responseText,
          ) as SyncResponseBody;
      } catch {
        throw new Error(
          "WaddleTracker sync endpoint returned invalid JSON.",
        );
      }

      return this.validateResponse(
        body,
      );
    } catch (
      error
    ) {
      if (
        error instanceof Error &&
        error.name ===
          "AbortError"
      ) {
        throw new Error(
          `WaddleTracker sync request timed out after ${String(
            this.timeoutMilliseconds,
          )}ms.`,
        );
      }

      throw error;
    } finally {
      clearTimeout(
        timeout,
      );
    }
  }

  private createHeaders():
    Record<
      string,
      string
    > {
    const headers:
      Record<
        string,
        string
      > = {
      Accept:
        "application/json",

      "Content-Type":
        "application/json",

      "User-Agent":
        "WaddleTracker-VSCode",
    };

    if (
      this.token
    ) {
      headers.Authorization =
        `Bearer ${this.token}`;
    }

    return headers;
  }

  private validateResponse(
    value:
      SyncResponseBody,
  ): SyncPushResult {
    if (
      typeof value.accepted !==
      "boolean"
    ) {
      throw new Error(
        "WaddleTracker sync endpoint returned an invalid accepted value.",
      );
    }

    if (
      typeof value.snapshotId !==
        "string" ||
      value.snapshotId.length ===
        0
    ) {
      throw new Error(
        "WaddleTracker sync endpoint returned an invalid snapshot id.",
      );
    }

    if (
      typeof value.receivedAt !==
        "string" ||
      Number.isNaN(
        new Date(
          value.receivedAt,
        ).getTime(),
      )
    ) {
      throw new Error(
        "WaddleTracker sync endpoint returned an invalid received timestamp.",
      );
    }

    return {
      accepted:
        value.accepted,

      snapshotId:
        value.snapshotId,

      receivedAt:
        value.receivedAt,
    };
  }

  private normalizeEndpoint(
    endpoint:
      string,
  ): string {
    const trimmed =
      endpoint.trim();

    if (
      trimmed.length ===
      0
    ) {
      throw new Error(
        "WaddleTracker sync endpoint is not configured.",
      );
    }

    let url:
      URL;

    try {
      url =
        new URL(
          trimmed,
        );
    } catch {
      throw new Error(
        "WaddleTracker sync endpoint is not a valid URL.",
      );
    }

    if (
      url.protocol !==
        "https:" &&
      url.protocol !==
        "http:"
    ) {
      throw new Error(
        "WaddleTracker sync endpoint must use HTTP or HTTPS.",
      );
    }

    return trimmed.replace(
      /\/+$/,
      "",
    );
  }

  private truncate(
    value:
      string,

    maximumLength:
      number,
  ): string {
    if (
      value.length <=
      maximumLength
    ) {
      return value;
    }

    return `${value.slice(
      0,
      maximumLength,
    )}…`;
  }
}

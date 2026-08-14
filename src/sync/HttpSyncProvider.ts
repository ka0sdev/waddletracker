import {
  SyncProvider,
  SyncPushResult,
  SyncSnapshot,
} from "./SyncTypes";

const DEFAULT_TIMEOUT_MS =
  15_000;

export type HttpSyncErrorKind =
  | "transient"
  | "configuration"
  | "protocol";

export class HttpSyncError
  extends Error
{
  public constructor(
    message:
      string,

    public readonly kind:
      HttpSyncErrorKind,

    public readonly statusCode?:
      number,
  ) {
    super(
      message,
    );

    this.name =
      "HttpSyncError";
  }
}

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
      throw new HttpSyncError(
        "Sync timeout must be a positive number.",
        "configuration",
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

        throw new HttpSyncError(
          `WaddleTracker sync failed with HTTP ${String(
            response.status,
          )}.${suffix}`,
          this.classifyHttpStatus(
            response.status,
          ),
          response.status,
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
        throw new HttpSyncError(
          "WaddleTracker sync endpoint returned invalid JSON.",
          "protocol",
          response.status,
        );
      }

      return this.validateResponse(
        body,
      );
    } catch (
      error
    ) {
      if (
        error instanceof
          HttpSyncError
      ) {
        throw error;
      }

      if (
        error instanceof Error &&
        error.name ===
          "AbortError"
      ) {
        throw new HttpSyncError(
          `WaddleTracker sync request timed out after ${String(
            this.timeoutMilliseconds,
          )}ms.`,
          "transient",
        );
      }

      throw new HttpSyncError(
        `WaddleTracker sync request failed: ${
          error instanceof Error
            ? error.message
            : String(
                error,
              )
        }`,
        "transient",
      );
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
      throw new HttpSyncError(
        "WaddleTracker sync endpoint returned an invalid accepted value.",
        "protocol",
      );
    }

    if (
      typeof value.snapshotId !==
        "string" ||
      value.snapshotId.length ===
        0
    ) {
      throw new HttpSyncError(
        "WaddleTracker sync endpoint returned an invalid snapshot id.",
        "protocol",
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
      throw new HttpSyncError(
        "WaddleTracker sync endpoint returned an invalid received timestamp.",
        "protocol",
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
      throw new HttpSyncError(
        "WaddleTracker sync endpoint is not configured.",
        "configuration",
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
      throw new HttpSyncError(
        "WaddleTracker sync endpoint is not a valid URL.",
        "configuration",
      );
    }

    if (
      url.protocol !==
        "https:" &&
      url.protocol !==
        "http:"
    ) {
      throw new HttpSyncError(
        "WaddleTracker sync endpoint must use HTTP or HTTPS.",
        "configuration",
      );
    }

    return trimmed.replace(
      /\/+$/,
      "",
    );
  }

  private classifyHttpStatus(
    statusCode:
      number,
  ): HttpSyncErrorKind {
    if (
      statusCode ===
        408 ||
      statusCode ===
        425 ||
      statusCode ===
        429 ||
      statusCode >=
        500
    ) {
      return "transient";
    }

    if (
      statusCode ===
        400 ||
      statusCode ===
        401 ||
      statusCode ===
        403 ||
      statusCode ===
        404
    ) {
      return "configuration";
    }

    return "protocol";
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

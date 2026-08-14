import assert from "node:assert/strict";
import * as http from "node:http";
import test from "node:test";

import {
  HttpSyncError,
  HttpSyncProvider,
} from "../src/sync/HttpSyncProvider";

import {
  SyncSnapshot,
} from "../src/sync/SyncTypes";

const snapshot:
  SyncSnapshot = {
  format:
    "waddletracker-sync",

  version:
    1,

  snapshotId:
    "0198aa5a-8b2f-7aa0-b019-5ae5706ac8d4",

  createdAt:
    "2026-08-14T18:00:00.000Z",

  source: {
    id:
      "source-1",

    name:
      "Desktop",

    platform:
      "win32",
  },

  state: {
    version:
      4,

    daily:
      {},

    sessions:
      [],
  },
};

async function withServer(
  statusCode:
    number,

  responseBody:
    string,

  callback:
    (
      endpoint:
        string,
    ) => Promise<void>,
): Promise<void> {
  const server =
    http.createServer(
      (
        _request,
        response,
      ) => {
        response.statusCode =
          statusCode;

        response.setHeader(
          "Content-Type",
          "application/json",
        );

        response.end(
          responseBody,
        );
      },
    );

  await new Promise<void>(
    (
      resolve,
    ) => {
      server.listen(
        0,
        "127.0.0.1",
        resolve,
      );
    },
  );

  const address =
    server.address();

  if (
    !address ||
    typeof address ===
      "string"
  ) {
    throw new Error(
      "Could not determine the test server address.",
    );
  }

  try {
    await callback(
      `http://127.0.0.1:${String(
        address.port,
      )}`,
    );
  } finally {
    await new Promise<void>(
      (
        resolve,
        reject,
      ) => {
        server.close(
          (
            error,
          ) => {
            if (
              error
            ) {
              reject(
                error,
              );

              return;
            }

            resolve();
          },
        );
      },
    );
  }
}

test(
  "HttpSyncProvider classifies HTTP 401 as configuration",
  async () => {
    await withServer(
      401,
      JSON.stringify({
        error:
          "unauthorized",
      }),
      async (
        endpoint,
      ) => {
        const provider =
          new HttpSyncProvider({
            endpoint,
          });

        await assert.rejects(
          () =>
            provider.pushSnapshot(
              snapshot,
            ),
          (
            error:
              unknown,
          ) =>
            error instanceof
              HttpSyncError &&
            error.kind ===
              "configuration" &&
            error.statusCode ===
              401,
        );
      },
    );
  },
);

test(
  "HttpSyncProvider classifies HTTP 503 as transient",
  async () => {
    await withServer(
      503,
      JSON.stringify({
        error:
          "unavailable",
      }),
      async (
        endpoint,
      ) => {
        const provider =
          new HttpSyncProvider({
            endpoint,
          });

        await assert.rejects(
          () =>
            provider.pushSnapshot(
              snapshot,
            ),
          (
            error:
              unknown,
          ) =>
            error instanceof
              HttpSyncError &&
            error.kind ===
              "transient" &&
            error.statusCode ===
              503,
        );
      },
    );
  },
);

test(
  "HttpSyncProvider classifies malformed success responses as protocol",
  async () => {
    await withServer(
      200,
      JSON.stringify({
        accepted:
          true,
      }),
      async (
        endpoint,
      ) => {
        const provider =
          new HttpSyncProvider({
            endpoint,
          });

        await assert.rejects(
          () =>
            provider.pushSnapshot(
              snapshot,
            ),
          (
            error:
              unknown,
          ) =>
            error instanceof
              HttpSyncError &&
            error.kind ===
              "protocol",
        );
      },
    );
  },
);

test(
  "HttpSyncProvider classifies invalid endpoint configuration",
  () => {
    assert.throws(
      () =>
        new HttpSyncProvider({
          endpoint:
            "not-a-url",
        }),
      (
        error:
          unknown,
      ) =>
        error instanceof
          HttpSyncError &&
        error.kind ===
          "configuration",
    );
  },
);

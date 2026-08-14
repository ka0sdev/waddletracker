import assert from "node:assert/strict";
import * as http from "node:http";
import test from "node:test";

import {
  HttpSyncProvider,
} from "../src/sync/HttpSyncProvider";

import {
  SyncSnapshot,
} from "../src/sync/SyncTypes";

function createSnapshot():
  SyncSnapshot {
  return {
    format:
      "waddletracker-sync",

    version:
      1,

    snapshotId:
      "snapshot-123",

    createdAt:
      "2026-08-14T10:00:00.000Z",

    source: {
      id:
        "desktop-main",

      name:
        "Main Desktop",

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
}

async function withServer(
  handler:
    http.RequestListener,

  callback:
    (
      endpoint:
        string,
    ) => Promise<void>,
): Promise<void> {
  const server =
    http.createServer(
      handler,
    );

  await new Promise<void>(
    (
      resolve,
      reject,
    ) => {
      server.once(
        "error",
        reject,
      );

      server.listen(
        0,
        "127.0.0.1",
        () => {
          resolve();
        },
      );
    },
  );

  try {
    const address =
      server.address();

    assert.ok(
      address &&
      typeof address !==
        "string",
    );

    await callback(
      `http://127.0.0.1:${String(
        address.port,
      )}`,
    );
  } finally {
    await new Promise<void>(
      (
        resolve,
      ) => {
        server.close(
          () => {
            resolve();
          },
        );
      },
    );
  }
}

async function readBody(
  request:
    http.IncomingMessage,
): Promise<string> {
  const chunks:
    Buffer[] = [];

  for await (
    const chunk
    of request
  ) {
    chunks.push(
      Buffer.isBuffer(
        chunk,
      )
        ? chunk
        : Buffer.from(
            chunk,
          ),
    );
  }

  return Buffer.concat(
    chunks,
  ).toString(
    "utf8",
  );
}

test(
  "HttpSyncProvider posts snapshots to the v1 sync endpoint",
  async () => {
    await withServer(
      async (
        request,
        response,
      ) => {
        assert.equal(
          request.method,
          "POST",
        );

        assert.equal(
          request.url,
          "/api/v1/sync/snapshots",
        );

        const body =
          JSON.parse(
            await readBody(
              request,
            ),
          );

        assert.equal(
          body.snapshotId,
          "snapshot-123",
        );

        response.writeHead(
          200,
          {
            "Content-Type":
              "application/json",
          },
        );

        response.end(
          JSON.stringify({
            accepted:
              true,

            snapshotId:
              "snapshot-123",

            receivedAt:
              "2026-08-14T10:00:01.000Z",
          }),
        );
      },
      async (
        endpoint,
      ) => {
        const provider =
          new HttpSyncProvider({
            endpoint:
              `${endpoint}/`,
          });

        const result =
          await provider
            .pushSnapshot(
              createSnapshot(),
            );

        assert.equal(
          result.accepted,
          true,
        );
      },
    );
  },
);

test(
  "HttpSyncProvider sends bearer authentication when configured",
  async () => {
    await withServer(
      (
        request,
        response,
      ) => {
        assert.equal(
          request.headers.authorization,
          "Bearer secret-token",
        );

        response.writeHead(
          200,
          {
            "Content-Type":
              "application/json",
          },
        );

        response.end(
          JSON.stringify({
            accepted:
              true,

            snapshotId:
              "snapshot-123",

            receivedAt:
              "2026-08-14T10:00:01.000Z",
          }),
        );
      },
      async (
        endpoint,
      ) => {
        const provider =
          new HttpSyncProvider({
            endpoint,

            token:
              "secret-token",
          });

        await provider
          .pushSnapshot(
            createSnapshot(),
          );
      },
    );
  },
);

test(
  "HttpSyncProvider reports HTTP failures",
  async () => {
    await withServer(
      (
        _request,
        response,
      ) => {
        response.writeHead(
          401,
          {
            "Content-Type":
              "text/plain",
          },
        );

        response.end(
          "Unauthorized",
        );
      },
      async (
        endpoint,
      ) => {
        const provider =
          new HttpSyncProvider({
            endpoint,
          });

        await assert.rejects(
          provider.pushSnapshot(
            createSnapshot(),
          ),
          /HTTP 401.*Unauthorized/,
        );
      },
    );
  },
);

test(
  "HttpSyncProvider validates successful response payloads",
  async () => {
    await withServer(
      (
        _request,
        response,
      ) => {
        response.writeHead(
          200,
          {
            "Content-Type":
              "application/json",
          },
        );

        response.end(
          JSON.stringify({
            accepted:
              true,

            snapshotId:
              42,

            receivedAt:
              "not-a-date",
          }),
        );
      },
      async (
        endpoint,
      ) => {
        const provider =
          new HttpSyncProvider({
            endpoint,
          });

        await assert.rejects(
          provider.pushSnapshot(
            createSnapshot(),
          ),
          /invalid snapshot id/i,
        );
      },
    );
  },
);

test(
  "HttpSyncProvider rejects unsupported endpoint protocols",
  () => {
    assert.throws(
      () =>
        new HttpSyncProvider({
          endpoint:
            "ftp://example.test",
        }),
      /must use HTTP or HTTPS/,
    );
  },
);

test(
  "HttpSyncProvider rejects an empty endpoint",
  () => {
    assert.throws(
      () =>
        new HttpSyncProvider({
          endpoint:
            "   ",
        }),
      /not configured/,
    );
  },
);

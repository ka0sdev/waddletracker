import {
  randomUUID,
} from "node:crypto";

import {
  TrackerState,
} from "../types/TrackerState";

import {
  SyncSnapshot,
  SyncSource,
  WADDLETRACKER_SYNC_FORMAT,
  WADDLETRACKER_SYNC_VERSION,
} from "./SyncTypes";

export class SyncSnapshotService {
  public createSnapshot(
    source:
      SyncSource,

    state:
      TrackerState,

    createdAt =
      new Date(),
  ): SyncSnapshot {
    if (
      state.version !==
      4
    ) {
      throw new Error(
        `Unsupported TrackerState version ${String(
          state.version,
        )}.`,
      );
    }

    this.validateSource(
      source,
    );

    return {
      format:
        WADDLETRACKER_SYNC_FORMAT,

      version:
        WADDLETRACKER_SYNC_VERSION,

      snapshotId:
        randomUUID(),

      createdAt:
        createdAt.toISOString(),

      source:
        {
          ...source,
        },

      state:
        this.cloneState(
          state,
        ),
    };
  }

  private validateSource(
    source:
      SyncSource,
  ): void {
    if (
      source.id.trim().length ===
      0
    ) {
      throw new Error(
        "Sync source id cannot be empty.",
      );
    }

    if (
      source.name.trim().length ===
      0
    ) {
      throw new Error(
        "Sync source name cannot be empty.",
      );
    }

    if (
      source.platform.trim().length ===
      0
    ) {
      throw new Error(
        "Sync source platform cannot be empty.",
      );
    }
  }

  private cloneState(
    state:
      TrackerState,
  ): TrackerState {
    return {
      version:
        4,

      daily:
        Object.fromEntries(
          Object.entries(
            state.daily,
          ).map(
            (
              [
                date,
                daily,
              ],
            ) => [
              date,
              {
                ...daily,

                projects:
                  this.cloneDimensions(
                    daily.projects,
                  ),

                languages:
                  this.cloneDimensions(
                    daily.languages,
                  ),

                files:
                  this.cloneDimensions(
                    daily.files,
                  ),
              },
            ],
          ),
        ),

      sessions:
        state.sessions.map(
          (session) => ({
            ...session,

            languages:
              this.cloneDimensions(
                session.languages,
              ),

            files:
              this.cloneDimensions(
                session.files,
              ),
          }),
        ),
    };
  }

  private cloneDimensions<
    T extends {
      activeMilliseconds:
        number;
    },
  >(
    dimensions:
      Record<
        string,
        T
      >,
  ): Record<
    string,
    T
  > {
    return Object.fromEntries(
      Object.entries(
        dimensions,
      ).map(
        (
          [
            key,
            statistics,
          ],
        ) => [
          key,
          {
            ...statistics,
          },
        ],
      ),
    ) as Record<
      string,
      T
    >;
  }
}

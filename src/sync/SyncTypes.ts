import {
  TrackerState,
} from "../types/TrackerState";

export const WADDLETRACKER_SYNC_FORMAT =
  "waddletracker-sync";

export const WADDLETRACKER_SYNC_VERSION =
  1;

export interface SyncSource {
  id:
    string;

  name:
    string;

  platform:
    string;

  remoteName?:
    string;
}

export interface SyncSnapshot {
  format:
    typeof WADDLETRACKER_SYNC_FORMAT;

  version:
    typeof WADDLETRACKER_SYNC_VERSION;

  snapshotId:
    string;

  createdAt:
    string;

  source:
    SyncSource;

  state:
    TrackerState;
}

export interface SyncPushResult {
  accepted:
    boolean;

  snapshotId:
    string;

  receivedAt:
    string;
}

export interface SyncProvider {
  pushSnapshot(
    snapshot:
      SyncSnapshot,
  ): Promise<SyncPushResult>;
}

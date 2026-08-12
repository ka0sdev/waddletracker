import { TrackerState } from "../types/TrackerState";

export interface StorageProvider {
  initialize(): Promise<void>;

  loadState(): Promise<TrackerState>;

  saveState(state: TrackerState): Promise<void>;

  dispose(): Promise<void>;
}
import * as fs from "node:fs/promises";
import * as path from "node:path";

import {
  createEmptyTrackerState,
  TrackerState,
} from "../types/TrackerState";

import { StorageProvider } from "./StorageProvider";

export class JsonStorageProvider implements StorageProvider {
  private readonly storageDirectory: string;
  private readonly stateFile: string;

  constructor(storageDirectory: string) {
    this.storageDirectory = storageDirectory;
    this.stateFile = path.join(
      storageDirectory,
      "waddletracker.json",
    );
  }

  public async initialize(): Promise<void> {
    await fs.mkdir(
      this.storageDirectory,
      {
        recursive: true,
      },
    );
  }

  public async loadState(): Promise<TrackerState> {
    try {
      const content = await fs.readFile(
        this.stateFile,
        "utf8",
      );

      const parsed = JSON.parse(
        content,
      ) as TrackerState;

      if (
        parsed.version !== 1 ||
        typeof parsed.daily !== "object"
      ) {
        throw new Error(
          "Unsupported WaddleTracker state format.",
        );
      }

      return parsed;
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return createEmptyTrackerState();
      }

      throw error;
    }
  }

  public async saveState(
    state: TrackerState,
  ): Promise<void> {
    const temporaryFile =
      `${this.stateFile}.tmp`;

    const content = JSON.stringify(
      state,
      null,
      2,
    );

    await fs.writeFile(
      temporaryFile,
      content,
      "utf8",
    );

    await fs.rename(
      temporaryFile,
      this.stateFile,
    );
  }

  public async dispose(): Promise<void> {
    // Nothing to dispose for local JSON storage.
  }
}
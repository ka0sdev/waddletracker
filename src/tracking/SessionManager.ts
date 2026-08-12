import { randomUUID } from "node:crypto";

import { ActivityContext } from "../types/ActivityContext";

import {
  CodingSession,
  SessionDimensionStats,
} from "../types/CodingSession";

import { TrackerState } from "../types/TrackerState";

export class SessionManager {
  private currentSession:
    CodingSession | undefined;

  constructor(
    private readonly state:
      TrackerState,
  ) {
    this.recoverDanglingSession();
  }

  public startSession(
    context: ActivityContext,
    startedAt: number,
  ): CodingSession {
    if (
      this.currentSession
    ) {
      return this.currentSession;
    }

    const timestamp =
      new Date(
        startedAt,
      ).toISOString();

    const session: CodingSession = {
      id:
        randomUUID(),

      startedAt:
        timestamp,

      endedAt:
        undefined,

      lastActivityAt:
        timestamp,

      activeMilliseconds:
        0,

      workspaceName:
        context.workspaceName,

      projectName:
        context.projectName,

      remoteName:
        context.remoteName,

      languages: {},

      files: {},
    };

    this.state.sessions.push(
      session,
    );

    this.currentSession =
      session;

    return session;
  }

  public markActivity(
    timestamp: number,
  ): void {
    if (
      !this.currentSession
    ) {
      return;
    }

    this.currentSession
      .lastActivityAt =
      new Date(
        timestamp,
      ).toISOString();
  }

  public recordActiveTime(
    milliseconds: number,
    activeUntil: number,
    context: ActivityContext,
  ): void {
    if (
      !this.currentSession ||
      milliseconds <= 0
    ) {
      return;
    }

    this.currentSession
      .activeMilliseconds +=
      milliseconds;

    if (
      context.languageId
    ) {
      this.incrementDimension(
        this.currentSession.languages,
        context.languageId,
        milliseconds,
      );
    }

    if (
      context.filePath
    ) {
      this.incrementDimension(
        this.currentSession.files,
        context.filePath,
        milliseconds,
      );
    }

    this.currentSession
      .lastActivityAt =
      new Date(
        activeUntil,
      ).toISOString();
  }

  public closeSession(
    endedAt: number,
  ): void {
    if (
      !this.currentSession
    ) {
      return;
    }

    this.currentSession.endedAt =
      new Date(
        endedAt,
      ).toISOString();

    this.currentSession =
      undefined;
  }

  public reset(): void {
    this.currentSession =
      undefined;

    this.state.sessions.length =
      0;
  }

  public getCurrentSession():
    CodingSession | undefined {
    if (
      !this.currentSession
    ) {
      return undefined;
    }

    return {
      ...this.currentSession,

      languages: {
        ...this.currentSession.languages,
      },

      files: {
        ...this.currentSession.files,
      },
    };
  }

  public getSessions():
    readonly CodingSession[] {
    return this.state.sessions;
  }

  private incrementDimension(
    collection: Record<
      string,
      SessionDimensionStats
    >,
    key: string,
    milliseconds: number,
  ): void {
    const current =
      collection[key] ?? {
        activeMilliseconds:
          0,
      };

    current.activeMilliseconds +=
      milliseconds;

    collection[key] =
      current;
  }

  private recoverDanglingSession(): void {
    const lastSession =
      this.state.sessions.at(
        -1,
      );

    if (
      !lastSession ||
      lastSession.endedAt
    ) {
      return;
    }

    lastSession.endedAt =
      lastSession.lastActivityAt;
  }
}

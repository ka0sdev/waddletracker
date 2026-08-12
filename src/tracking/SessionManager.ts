import { randomUUID } from "node:crypto";

import { ActivityContext } from "../types/ActivityContext";
import { CodingSession } from "../types/CodingSession";
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
    if (this.currentSession) {
      return this.currentSession;
    }

    const timestamp =
      new Date(
        startedAt,
      ).toISOString();

    const session: CodingSession = {
      id: randomUUID(),

      startedAt: timestamp,
      endedAt: undefined,
      lastActivityAt: timestamp,

      activeMilliseconds: 0,

      workspaceName:
        context.workspaceName,

      projectName:
        context.projectName,

      remoteName:
        context.remoteName,
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
    if (!this.currentSession) {
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

    this.currentSession
      .lastActivityAt =
      new Date(
        activeUntil,
      ).toISOString();
  }

  public closeSession(
    endedAt: number,
  ): void {
    if (!this.currentSession) {
      return;
    }

    this.currentSession.endedAt =
      new Date(
        endedAt,
      ).toISOString();

    this.currentSession =
      undefined;
  }

  public getCurrentSession():
    CodingSession | undefined {
    if (!this.currentSession) {
      return undefined;
    }

    return {
      ...this.currentSession,
    };
  }

  public getSessions():
    readonly CodingSession[] {
    return this.state.sessions;
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
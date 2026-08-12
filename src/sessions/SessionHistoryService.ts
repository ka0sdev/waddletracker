import { CodingSession } from "../types/CodingSession";

import {
  SessionHistoryGroup,
} from "../types/SessionHistoryTypes";

export class SessionHistoryService {
  public getGroups(
    sessions:
      readonly CodingSession[],
  ): SessionHistoryGroup[] {
    const groups =
      new Map<
        string,
        CodingSession[]
      >();

    const sortedSessions =
      [...sessions]
        .sort(
          (
            first,
            second,
          ) =>
            new Date(
              second.startedAt,
            ).getTime() -
            new Date(
              first.startedAt,
            ).getTime(),
        );

    for (
      const session
      of sortedSessions
    ) {
      const date =
        this.getLocalDateKey(
          new Date(
            session.startedAt,
          ),
        );

      const existing =
        groups.get(
          date,
        ) ?? [];

      existing.push(
        this.cloneSession(
          session,
        ),
      );

      groups.set(
        date,
        existing,
      );
    }

    return [
      ...groups.entries(),
    ]
      .sort(
        (
          [first],
          [second],
        ) =>
          second.localeCompare(
            first,
          ),
      )
      .map(
        (
          [
            date,
            groupedSessions,
          ],
        ): SessionHistoryGroup => ({
          date,

          activeMilliseconds:
            groupedSessions.reduce(
              (
                total,
                session,
              ) =>
                total +
                session.activeMilliseconds,
              0,
            ),

          sessions:
            groupedSessions,
        }),
      );
  }

  private cloneSession(
    session:
      CodingSession,
  ): CodingSession {
    return {
      ...session,

      languages: {
        ...session.languages,
      },

      files: {
        ...session.files,
      },
    };
  }

  private getLocalDateKey(
    date:
      Date,
  ): string {
    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1,
      ).padStart(
        2,
        "0",
      );

    const day =
      String(
        date.getDate(),
      ).padStart(
        2,
        "0",
      );

    return (
      `${year}-${month}-${day}`
    );
  }
}
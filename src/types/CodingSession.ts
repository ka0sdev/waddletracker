export interface SessionDimensionStats {
  activeMilliseconds: number;
}

export interface CodingSession {
  id: string;

  startedAt: string;
  endedAt: string | undefined;
  lastActivityAt: string;

  activeMilliseconds: number;

  workspaceName: string | undefined;
  projectName: string | undefined;
  remoteName: string | undefined;

  languages: Record<
    string,
    SessionDimensionStats
  >;

  files: Record<
    string,
    SessionDimensionStats
  >;
}
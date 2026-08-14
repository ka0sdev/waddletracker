export interface SessionDimensionStats {
  activeMilliseconds: number;
}

export interface CodingSession {
  id: string;

  startedAt: string;
  endedAt?: string;
  lastActivityAt: string;

  activeMilliseconds: number;

  workspaceName?: string;
  projectName?: string;
  remoteName?: string;

  languages: Record<
    string,
    SessionDimensionStats
  >;

  files: Record<
    string,
    SessionDimensionStats
  >;
}

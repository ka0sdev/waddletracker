export interface CodingSession {
  id: string;

  startedAt: string;
  endedAt: string | undefined;
  lastActivityAt: string;

  activeMilliseconds: number;

  workspaceName: string | undefined;
  projectName: string | undefined;
  remoteName: string | undefined;
}
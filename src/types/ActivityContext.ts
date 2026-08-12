export interface ActivityContext {
  workspaceName: string | undefined;
  workspaceUri: string | undefined;

  projectName: string | undefined;

  fileName: string | undefined;
  filePath: string | undefined;

  languageId: string | undefined;

  remoteName: string | undefined;
}
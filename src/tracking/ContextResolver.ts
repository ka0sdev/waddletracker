import * as vscode from "vscode";

import { ActivityContext } from "../types/ActivityContext";

export class ContextResolver {
  public resolve(): ActivityContext {
    const editor =
      vscode.window.activeTextEditor;

    const document =
      editor?.document;

    const fileUri =
      document?.uri;

    const workspaceFolder =
      fileUri
        ? vscode.workspace.getWorkspaceFolder(
            fileUri,
          )
        : undefined;

    const workspaceName =
      vscode.workspace.name;

    const workspaceUri =
      vscode.workspace.workspaceFile?.toString() ??
      workspaceFolder?.uri.toString();

    const projectName =
      workspaceFolder?.name ??
      workspaceName;

    const isTrackableFile =
      fileUri?.scheme === "file" ||
      fileUri?.scheme === "vscode-remote";

    const fileName =
      isTrackableFile && fileUri
        ? this.getFileName(
            fileUri.path,
          )
        : undefined;

    const filePath =
      isTrackableFile &&
      document &&
      workspaceFolder
        ? vscode.workspace.asRelativePath(
            document.uri,
            false,
          )
        : fileName;

    const languageId =
      document?.languageId;

    return {
      workspaceName,
      workspaceUri,

      projectName,

      fileName,
      filePath,

      languageId,

      remoteName:
        vscode.env.remoteName,
    };
  }

  private getFileName(
    filePath: string,
  ): string | undefined {
    const parts =
      filePath.split("/");

    return (
      parts.at(-1) ||
      undefined
    );
  }
}
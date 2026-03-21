import * as vscode from 'vscode';
import * as os from 'os';

export const USER_HOME_TOKEN = '${userHome}';
export const WORKSPACE_TOKEN = '${workspaceFolder}';

export function resolveTokenizedPath(rawValue: string, contextUri?: vscode.Uri): string {
  if (isBareCommand(rawValue)) {
    return rawValue;
  }

  const resolved = resolveTokens(rawValue, contextUri);
  try {
    return vscode.Uri.file(resolved).fsPath;
  } catch {
    return resolved;
  }
}

function isBareCommand(value: string): boolean {
  return /^[^/\\$]+$/.test(value);
}

function resolveTokens(tokenizedPath: string, contextUri?: vscode.Uri): string {
  if (tokenizedPath.includes(USER_HOME_TOKEN)) {
    return tokenizedPath.replace(USER_HOME_TOKEN, os.homedir());
  }

  if (tokenizedPath.includes(WORKSPACE_TOKEN)) {
    const workspaceFolder = contextUri
      ? vscode.workspace.getWorkspaceFolder(contextUri)
      : vscode.workspace.workspaceFolders?.[0];
    return tokenizedPath.replace(WORKSPACE_TOKEN, workspaceFolder?.uri.fsPath ?? '');
  }

  return tokenizedPath;
}

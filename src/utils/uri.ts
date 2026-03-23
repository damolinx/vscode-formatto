import * as vscode from 'vscode';

export function normalizeForDisplay(uri: vscode.Uri): string {
  return uri.scheme === 'file' ? uri.fsPath : uri.toString(true);
}

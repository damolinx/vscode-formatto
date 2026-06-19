import * as vscode from 'vscode';

export interface FormatContext {
  readonly isDirty: boolean;
  readonly languageId: string;
  readonly range?: vscode.Range;
  readonly uri: vscode.Uri;
}

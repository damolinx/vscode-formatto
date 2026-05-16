import * as vscode from 'vscode';

export interface FormatContext {
  readonly isDirty: boolean;
  readonly isRange: boolean;
  readonly languageId: string;
  readonly uri: vscode.Uri;
}

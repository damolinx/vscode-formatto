import * as vscode from 'vscode';

export interface FormatContext {
  readonly isDirty: boolean;
  readonly isRange: boolean;
  readonly uri: vscode.Uri;
}

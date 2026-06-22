import * as vscode from 'vscode';
import { FormatterId } from './formatterId';

export interface FormatterSpec {
  id: FormatterId;
  name: string;

  docs: Readonly<{
    installation?: vscode.Uri;
    project?: vscode.Uri;
  }>;

  supportedExtensions: readonly string[];
  supportedLanguages: readonly string[];

  supportsBundler: boolean;
}

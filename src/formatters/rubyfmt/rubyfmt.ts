import * as vscode from 'vscode';
import { ExtensionContext } from '../../extensionContext';
import { Formatter } from '../formatter';
import { RubyfmtFormatterSpec } from './rubyfmtSpec';

export class RubyfmtFormatter extends Formatter {
  constructor(context: ExtensionContext) {
    super(context, RubyfmtFormatterSpec);
  }

  protected format(
    document: vscode.TextDocument,
    range?: vscode.Range,
    token?: vscode.CancellationToken,
  ): Promise<string | undefined> {
    return this.run({ text: document.getText(range), range, uri: document.uri }, undefined, token);
  }
}

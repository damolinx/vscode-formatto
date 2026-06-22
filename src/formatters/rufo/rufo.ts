import * as vscode from 'vscode';
import { ExtensionContext } from '../../extensionContext';
import { Formatter } from '../formatter';
import { RufoFormatterSpec } from './rufoSpec';

export class RufoFormatter extends Formatter {
  constructor(context: ExtensionContext) {
    super(context, RufoFormatterSpec);
  }

  protected format(
    document: vscode.TextDocument,
    range?: vscode.Range,
    token?: vscode.CancellationToken,
  ): Promise<string | undefined> {
    return this.run(
      { text: document.getText(range), range, uri: document.uri },
      {
        args: ['--simple-exit', '--filename', document.uri.fsPath],
        env: { ...process.env, RUBYOPT: '-W0' },
      },
      token,
    );
  }
}

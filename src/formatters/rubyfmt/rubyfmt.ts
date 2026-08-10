import * as vscode from 'vscode';
import { ExtensionContext } from '../../extensionContext';
import { Formatter, FormatterCommand } from '../formatter';
import { RubyfmtFormatterSpec } from './rubyfmtSpec';

export class RubyfmtFormatter extends Formatter {
  constructor(context: ExtensionContext) {
    super(context, RubyfmtFormatterSpec);
  }

  public override buildFormatCommand(
    scope: vscode.ConfigurationScope | undefined,
    uris?: readonly vscode.Uri[],
    ...additionalArgs: string[]
  ): FormatterCommand {
    if (uris) {
      return this.buildCommand(
        scope,
        '--in-place',
        ...uris.map(({ fsPath }) => fsPath),
        ...additionalArgs,
        ...this.getFormatConfiguredArgs(scope),
      );
    }

    return this.buildCommand(scope, ...additionalArgs, ...this.getFormatConfiguredArgs(scope));
  }

  protected override async formatDocumentCore(
    document: vscode.TextDocument,
    range?: vscode.Range,
    token?: vscode.CancellationToken,
  ): Promise<string | undefined> {
    const text = document.getText(range);
    const command = this.buildFormatCommand(document.uri);
    const { stdout } = await this.execute(
      command,
      {
        stdinInput: text,
      },
      token,
    );

    return stdout !== text ? stdout : undefined;
  }
}

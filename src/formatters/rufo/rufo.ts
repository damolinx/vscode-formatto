import * as vscode from 'vscode';
import { ExtensionContext } from '../../extensionContext';
import { Formatter, FormatterCommand } from '../formatter';
import { RufoFormatterSpec } from './rufoSpec';

export class RufoFormatter extends Formatter {
  constructor(context: ExtensionContext) {
    super(context, RufoFormatterSpec);
  }

  public override buildFormatCommand(
    scope: vscode.ConfigurationScope | undefined,
    uris?: readonly vscode.Uri[],
    ...additionalArgs: string[]
  ): FormatterCommand {
    return this.buildCommand(
      scope,
      '--simple-exit',
      ...(uris?.map(({ fsPath }) => fsPath) ?? []),
      ...additionalArgs,
      ...this.getFormatConfiguredArgs(scope),
    );
  }

  protected override async formatDocumentCore(
    document: vscode.TextDocument,
    range?: vscode.Range,
    token?: vscode.CancellationToken,
  ): Promise<string | undefined> {
    const text = document.getText(range);
    const command = this.buildFormatCommand(
      document.uri,
      undefined,
      '--filename',
      document.uri.fsPath,
    );
    const { stdout } = await this.execute(
      command,
      {
        env: { ...process.env, RUBYOPT: '-W0' },
        stdinInput: text,
      },
      token,
    );

    return stdout !== text ? stdout : undefined;
  }
}

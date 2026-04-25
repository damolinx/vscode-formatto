import * as vscode from 'vscode';
import { verifyFormatter } from '../commands/verifyFormatter';
import { ExtensionContext } from '../extensionContext';
import { Formatter } from './formatter';
import { FormatterDescriptor } from './types';

export const RubyfmtDescriptor: FormatterDescriptor = {
  id: 'rubyfmt',
  injectsTrailingNewline: true,
  installUrl: 'https://github.com/fables-tales/rubyfmt?tab=readme-ov-file#installation',
  versionArgs: ['--version'],
};

export class RubyfmtFormatter extends Formatter {
  constructor(context: ExtensionContext) {
    super(context, RubyfmtDescriptor);
  }

  public override async formatText(
    { uri }: vscode.TextDocument,
    text: string,
    _isRange?: boolean,
    token?: vscode.CancellationToken,
  ): Promise<string | undefined> {
    if (!(await verifyFormatter(this.context, uri, this))) {
      return;
    }

    return this.run(text, uri, {}, token);
  }

  public override getFormatterCommand(scope?: vscode.ConfigurationScope): string[] {
    return [this.context.configuration.getFormatterPath(this.id, scope)];
  }
}

import * as vscode from 'vscode';
import { verifyFormatter } from '../commands/verifyFormatter';
import { ExtensionContext } from '../extensionContext';
import { Formatter } from './formatter';
import { FormatterDescriptor } from './types';

export const RubyfmtDescriptor: FormatterDescriptor = {
  id: 'rubyfmt',
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
    token?: vscode.CancellationToken,
  ): Promise<string | undefined> {
    const options = {
      cmd: this.getFormatterCommand(uri),
      cwd: this.getCwd(uri),
    };

    if (!(await verifyFormatter(this.context, uri, options, this.descriptor))) {
      return;
    }

    return this.run(text, uri, options, token);
  }
}

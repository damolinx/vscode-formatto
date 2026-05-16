import * as vscode from 'vscode';
import { verifyFormatter } from '../commands/verifyFormatter';
import { ExtensionContext } from '../extensionContext';
import { FormatContext } from './formatContext';
import { Formatter } from './formatter';
import { FormatterSpec } from './formatterSpec';

export const RufoDescriptor: FormatterSpec = {
  name: 'rufo',
  appendsTrailingNewline: true,
  docs: { installation: 'https://github.com/ruby-formatter/rufo?tab=readme-ov-file#installation' },
  inputKind: 'stdin',
  versionArgs: ['--version'],
};

export class RufoFormatter extends Formatter {
  constructor(context: ExtensionContext) {
    super(context, RufoDescriptor);
  }

  public override async formatText(
    text: string,
    { uri }: FormatContext,
    token?: vscode.CancellationToken,
  ): Promise<string | undefined> {
    if (!(await verifyFormatter(this.context, uri, this))) {
      return;
    }

    const formattedText = await this.run(
      text,
      uri,
      {
        args: ['--simple-exit', '--filename', uri.fsPath],
        env: { ...process.env, RUBYOPT: '-W0' },
      },
      token,
    );
    return formattedText;
  }
}

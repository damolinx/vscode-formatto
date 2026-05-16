import * as vscode from 'vscode';
import { verifyFormatter } from '../commands/verifyFormatter';
import { ExtensionContext } from '../extensionContext';
import { Formatter } from './formatter';
import { FormatterSpec } from './formatterSpec';

export const RufoDescriptor: FormatterSpec = {
  name: 'rufo',
  injectsTrailingNewline: true,
  docs: { installation: 'https://github.com/ruby-formatter/rufo?tab=readme-ov-file#installation' },
  versionArgs: ['--version'],
};

export class RufoFormatter extends Formatter {
  constructor(context: ExtensionContext) {
    super(context, RufoDescriptor);
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

    return this.run(
      text,
      uri,
      {
        args: ['--simple-exit', '--filename', uri.fsPath],
        env: { ...process.env, RUBYOPT: '-W0' },
      },
      token,
    );
  }
}

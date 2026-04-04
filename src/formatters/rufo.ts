import * as vscode from 'vscode';
import { verifyFormatter } from '../commands/verifyFormatter';
import { ExtensionContext } from '../extensionContext';
import { Formatter } from './formatter';
import { FormatterDescriptor } from './types';

export const RufoDescriptor: FormatterDescriptor = {
  id: 'rufo',
  injectsTrailingNewline: true,
  installUrl: 'https://github.com/ruby-formatter/rufo?tab=readme-ov-file#installation',
  versionArgs: ['--version'],
};

export class RufoFormatter extends Formatter {
  constructor(context: ExtensionContext) {
    super(context, RufoDescriptor);
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

    return this.run(text, uri, { args: ['--filename', uri.fsPath] }, token);
  }

  protected override isSuccessCode(code: number): boolean {
    // 0: no changes, 3: changes
    return code === 0 || code === 3;
  }
}

import * as vscode from 'vscode';
import { verifyFormatterCore } from '../commands/verifyFormatter';
import { SUPPORTED_RUBY_EXTENSIONS } from '../constants';
import { ExtensionContext } from '../extensionContext';
import { FormatContext } from './formatContext';
import { Formatter } from './formatter';
import { FormatterSpec } from './formatterSpec';

export const RufoDescriptor: FormatterSpec = {
  name: 'rufo',
  appendsTrailingNewline: true,
  docs: { installation: 'https://github.com/ruby-formatter/rufo?tab=readme-ov-file#installation' },
  inputKind: 'stdin',
  supportedExtensions: SUPPORTED_RUBY_EXTENSIONS.concat(['.erb', '.rhtml']),
  versionArgs: ['--version'],
};

export class RufoFormatter extends Formatter {
  constructor(context: ExtensionContext) {
    super(context, RufoDescriptor);
  }

  public override async formatText(
    text: string,
    formatContext: FormatContext,
    token?: vscode.CancellationToken,
  ): Promise<string | undefined> {
    if (!(await verifyFormatterCore(this.context, this, formatContext.uri))) {
      return;
    }

    const formattedText = await this.run(
      text,
      formatContext,
      {
        args: ['--simple-exit', '--filename', formatContext.uri.fsPath],
        env: { ...process.env, RUBYOPT: '-W0' },
      },
      token,
    );
    return formattedText;
  }
}

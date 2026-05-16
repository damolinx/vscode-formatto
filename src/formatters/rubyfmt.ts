import * as vscode from 'vscode';
import { verifyFormatter } from '../commands/verifyFormatter';
import { SUPPORTED_RUBY_EXTENSIONS } from '../constants';
import { ExtensionContext } from '../extensionContext';
import { FormatContext } from './formatContext';
import { Formatter } from './formatter';
import { FormatterSpec } from './formatterSpec';

export const RubyfmtDescriptor: FormatterSpec = {
  name: 'rubyfmt',
  appendsTrailingNewline: true,
  docs: { installation: 'https://github.com/fables-tales/rubyfmt?tab=readme-ov-file#installation' },
  inputKind: 'stdin',
  supportedExtensions: SUPPORTED_RUBY_EXTENSIONS,
  versionArgs: ['--version'],
};

export class RubyfmtFormatter extends Formatter {
  constructor(context: ExtensionContext) {
    super(context, RubyfmtDescriptor);
  }

  public override async formatText(
    text: string,
    formatContext: FormatContext,
    token?: vscode.CancellationToken,
  ): Promise<string | undefined> {
    if (!(await verifyFormatter(this.context, formatContext.uri, this))) {
      return;
    }

    const formattedText = await this.run(text, formatContext, {}, token);
    return formattedText;
  }

  public override getFormatterCommand(scope?: vscode.ConfigurationScope): string[] {
    return [this.context.configuration.getFormatterPath(this.name, scope)];
  }
}

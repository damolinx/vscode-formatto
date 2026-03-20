import * as vscode from 'vscode';
import { ExtensionContext } from '../extensionContext';
import { tryFormatText } from '../rubyfmt';

export function registerRangeFormattingEditProvider(context: ExtensionContext): void {
  context.disposables.push(
    vscode.languages.registerDocumentRangeFormattingEditProvider(
      'ruby',
      new RangeFormattingEditProvider(context),
    ),
  );
}

/**
 * Format a selection in a Ruby document. Range formatting is not supported by
 * `rubyfmt` so this implementation uses the selection as document and adjusts
 * the indentation if `rubyfmt` succeeds. Experimental.
 */
export class RangeFormattingEditProvider implements vscode.DocumentRangeFormattingEditProvider {
  constructor(private readonly context: ExtensionContext) {}

  async provideDocumentRangeFormattingEdits(
    document: vscode.TextDocument,
    range: vscode.Range,
    _options: vscode.FormattingOptions,
    token: vscode.CancellationToken,
  ): Promise<vscode.TextEdit[] | undefined> {
    if (range.isEmpty) {
      return;
    }

    const formattedText = await tryFormatText(this.context, document, range, token);
    if (!formattedText) {
      return;
    }

    const indentation = RangeFormattingEditProvider.getIndentOfFirstNonEmptyLine(document, range);
    if (indentation > 0 && range.start.character <= indentation) {
      return [
        vscode.TextEdit.replace(
          range,
          RangeFormattingEditProvider.indentText(formattedText, indentation),
        ),
      ];
    }

    return [vscode.TextEdit.replace(range, formattedText)];
  }

  private static getIndentOfFirstNonEmptyLine(
    document: vscode.TextDocument,
    range: vscode.Range,
  ): number {
    for (let line = range.start.line; line <= range.end.line; line++) {
      const textLine = document.lineAt(line);
      if (!textLine.isEmptyOrWhitespace) {
        return textLine.firstNonWhitespaceCharacterIndex;
      }
    }
    return 0;
  }

  private static indentText(text: string, indent: number): string {
    const spaces = ' '.repeat(indent);
    return text
      .split('\n')
      .map((line) => (line ? spaces + line : line))
      .join('\n');
  }
}

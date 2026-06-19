import * as vscode from 'vscode';
import { DOCUMENT_SELECTOR } from '../constants';
import { ExtensionContext } from '../extensionContext';

export function registerRangeFormattingEditProvider(context: ExtensionContext): void {
  if (!context.configuration.enableRangeFormatting) {
    context.log.info(
      "RangeFormat: Disabled. Use 'formatto.enableRangeFormatting' setting to enable it.",
    );
    return;
  }

  context.log.debug('RangeFormat: Enabled');
  context.disposables.push(
    vscode.languages.registerDocumentRangeFormattingEditProvider(
      DOCUMENT_SELECTOR,
      new RangeFormattingEditProvider(context),
    ),
  );
}

/**
 * Format a selection in a Ruby document. Range formatting is not supported by
 * formatters so this implementation uses the selection as as-is and adjusts
 * the indentation. Experimental.
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

    const { formatter, reason } = this.context.formatters.resolveFor(document.uri);
    if (!formatter) {
      this.context.log.error(`RangeFormat: ${reason}. ${document.uri.fsPath}`);
      vscode.window.showErrorMessage(reason);
      return;
    }

    let formattedText = await formatter.tryFormatText(document, range, token);
    if (!formattedText) {
      this.context.log.debug(`RangeFormat: No changes to apply. ${document.uri.fsPath}`);
      return;
    }

    if (formatter.spec.appendsTrailingNewline) {
      if (range.end.line !== document.lineCount - 1 && formattedText.endsWith('\n')) {
        formattedText = formattedText.slice(0, -1);
      }
    }

    const indentation = RangeFormattingEditProvider.getIndentOfFirstPrecedingNonEmptyLine(
      document,
      range,
    );
    if (indentation > 0 && range.start.character < indentation) {
      return [
        vscode.TextEdit.replace(
          range,
          RangeFormattingEditProvider.indentText(formattedText, indentation),
        ),
      ];
    }

    return [vscode.TextEdit.replace(range, formattedText)];
  }

  private static getIndentOfFirstPrecedingNonEmptyLine(
    document: vscode.TextDocument,
    range: vscode.Range,
  ): number {
    for (let line = range.start.line - 1; line >= 0; line--) {
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

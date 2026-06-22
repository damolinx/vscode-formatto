import * as vscode from 'vscode';
import { ExtensionContext } from '../extensionContext';
import { validateFormatter } from '../formatters/formatterValidation';

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
      context.formatters.getSupportedLanguages(),
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

    const validationReason = validateFormatter(this.context, formatter, document.uri);
    if (validationReason) {
      this.context.log.error(
        `RangeFormat(${formatter.spec.id}): ${validationReason}. ${document.uri.fsPath}`,
      );
      vscode.window.showErrorMessage(validationReason);
      return;
    }

    const formattingEdit = await formatter.formatDocument(document, range, token);
    if (!formattingEdit) {
      this.context.log.debug(
        `RangeFormat(${formatter.spec.id}): No changes to apply. ${document.uri.fsPath}`,
      );
      return;
    }

    const indentation = RangeFormattingEditProvider.getIndentOfFirstPrecedingNonEmptyLine(
      document,
      range,
    );
    if (indentation > 0 && range.start.character < indentation) {
      formattingEdit.newText = RangeFormattingEditProvider.indentText(
        formattingEdit.newText,
        indentation,
      );
    }

    return [formattingEdit];
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

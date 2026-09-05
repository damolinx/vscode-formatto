import * as vscode from 'vscode';
import { ExtensionContext } from '../extensionContext';
import { validateFormatter } from '../formatters/formatterValidation';

export function registerRangeFormattingEditProvider(context: ExtensionContext): void {
  if (!context.configuration.enableRangeFormatting) {
    context.log.info(
      "Range formatting is disabled. Use 'formatto.enableRangeFormatting' setting to enable it.",
    );
    return;
  }

  context.log.debug(
    "Range formatting is enabled. Use 'formatto.enableRangeFormatting' setting to disable it.",
  );
  context.disposables.push(
    vscode.languages.registerDocumentRangeFormattingEditProvider(
      context.formatters.getSupportedLanguages(),
      new RangeFormattingEditProvider(context),
    ),
  );
}

/**
 * Format a selection in a Ruby document. Range formatting is not supported by
 * formatters so this implementation uses the selection as-is and adjusts the
 * indentation. Experimental.
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

    const location =
      `${document.uri.fsPath} ` +
      `[${range.start.line + 1}:${range.start.character + 1}-` +
      `${range.end.line + 1}:${range.end.character + 1}]`;

    const { formatter, reason } = this.context.formatters.resolveFor(document.uri);
    if (!formatter) {
      this.context.log.error(`No formatter found for ${location}. Reason: ${reason}`);
      return;
    }

    const validationReason = validateFormatter(this.context, formatter, document.uri);
    if (validationReason) {
      this.context.log.warn(
        `${formatter.spec.id}: Cannot format ${location}. Reason: ${validationReason}`,
      );
      return;
    }

    let formattingEdit: vscode.TextEdit | undefined;
    try {
      formattingEdit = await formatter.formatEdit(document, range, token);
    } catch (error) {
      this.context.log.error(`${formatter.spec.id}: Failed to format ${location}`, error);
      return;
    }

    if (!formattingEdit) {
      this.context.log.debug(
        `${formatter.spec.id}: No formatting changes generated for ${location}`,
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

    this.context.log.debug(`${formatter.spec.id}: Formatting changes generated for ${location}`);
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

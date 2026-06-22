import * as vscode from 'vscode';
import { ExtensionContext } from '../extensionContext';
import { validateFormatter } from '../formatters/formatterValidation';

export function registerDocumentFormattingEditProvider(context: ExtensionContext): void {
  context.disposables.push(
    vscode.languages.registerDocumentFormattingEditProvider(
      context.formatters.getSupportedLanguages(),
      new DocumentFormattingEditProvider(context),
    ),
  );
}

/**
 * Format a Ruby document.
 */
export class DocumentFormattingEditProvider implements vscode.DocumentFormattingEditProvider {
  constructor(private readonly context: ExtensionContext) {}

  async provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    _options: vscode.FormattingOptions,
    token: vscode.CancellationToken,
  ): Promise<vscode.TextEdit[] | undefined> {
    const { formatter, reason } = this.context.formatters.resolveFor(document.uri);
    if (!formatter) {
      this.context.log.error(`DocumentFormat: ${reason}. ${document.uri.fsPath}`);
      return;
    }

    const validationReason = validateFormatter(this.context, formatter, document.uri);
    if (validationReason) {
      this.context.log.error(
        `DocumentFormat(${formatter.spec.id}): ${validationReason}. ${document.uri.fsPath}`,
      );
      return;
    }

    const formattingEdit = await formatter
      .formatDocument(document, undefined, token)
      .catch((error) => {
        this.context.log.error(
          `DocumentFormat(${formatter.spec.id}): Formatting failed. ${document.uri.fsPath}`,
          error,
        );
        return;
      });

    if (!formattingEdit) {
      this.context.log.debug(
        `DocumentFormat(${formatter.spec.id}): No changes to apply. ${document.uri.fsPath}`,
      );
      return;
    }

    return [formattingEdit];
  }
}

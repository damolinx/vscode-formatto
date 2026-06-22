import * as vscode from 'vscode';
import { DOCUMENT_SELECTOR } from '../constants';
import { ExtensionContext } from '../extensionContext';
import { validateFormatter } from '../formatters/formatterValidation';

export function registerDocumentFormattingEditProvider(context: ExtensionContext): void {
  context.disposables.push(
    vscode.languages.registerDocumentFormattingEditProvider(
      DOCUMENT_SELECTOR,
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
      vscode.window.showErrorMessage(reason);
      return;
    }

    const validationReason = validateFormatter(this.context, formatter, document.uri);
    if (validationReason) {
      this.context.log.error(
        `DocumentFormat(${formatter.spec.id}): ${validationReason}. ${document.uri.fsPath}`,
      );
      vscode.window.showErrorMessage(validationReason);
      return;
    }

    const formattingEdit = await formatter
      .formatDocument(document, undefined, token)
      .catch((error) => {
        this.context.log.error(
          `DocumentFormat(${formatter.spec.id}): Formatting failed. ${document.uri.fsPath}`,
          error,
        );
        vscode.window
          .showErrorMessage(
            error.message ?? 'An unknown error occurred during formatting.',
            'Show Logs',
          )
          .then((selection) => {
            if (selection) {
              this.context.log.show(true);
            }
          });
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

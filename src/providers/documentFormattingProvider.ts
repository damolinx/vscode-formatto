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
      this.context.log.error(`No formatter found for ${document.uri.fsPath}. Reason: ${reason}`);
      return;
    }

    const validationReason = validateFormatter(this.context, formatter, document.uri);
    if (validationReason) {
      this.context.log.warn(
        `${formatter.spec.id}: Cannot format ${document.uri.fsPath}. Reason: ${validationReason}`,
      );
      return;
    }

    const formattingEdit = await formatter.formatEdit(document, undefined, token).catch((error) => {
      this.context.log.error(
        `${formatter.spec.id}: Failed to format ${document.uri.fsPath}`,
        error,
      );
      return;
    });

    if (!formattingEdit) {
      this.context.log.debug(
        `${formatter.spec.id}: No formatting changes for ${document.uri.fsPath}`,
      );
      return;
    }

    this.context.log.debug(
      `${formatter.spec.id}: Generated formatting changes for ${document.uri.fsPath}`,
    );
    return [formattingEdit];
  }
}

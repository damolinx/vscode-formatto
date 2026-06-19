import * as vscode from 'vscode';
import { DOCUMENT_SELECTOR } from '../constants';
import { ExtensionContext } from '../extensionContext';

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
      this.context.log.error(
        `DocumentFormat: ${reason}. Path: ${vscode.workspace.asRelativePath(document.uri)}`,
      );
      vscode.window.showErrorMessage(reason);
      return;
    }

    const formattedText = await formatter.tryFormatDocument(document, token);
    if (!formattedText) {
      this.context.log.debug(
        `DocumentFormat(${formatter.name}): No changes to apply. Path: ${vscode.workspace.asRelativePath(document.uri)}`,
      );
      return;
    }

    const documentRange = document.validateRange(
      new vscode.Range(0, 0, document.lineCount, Number.MAX_SAFE_INTEGER),
    );
    return [vscode.TextEdit.replace(documentRange, formattedText)];
  }
}

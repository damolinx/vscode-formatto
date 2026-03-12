import * as vscode from 'vscode';
import { ExtensionContext } from '../extensionContext';
import { tryFormatDocument } from '../rubyfmt';

export function registerDocumentFormattingEditProvider(context: ExtensionContext): void {
  context.disposables.push(
    vscode.languages.registerDocumentFormattingEditProvider(
      'ruby',
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
    const formattedText = await tryFormatDocument(this.context, document, token);
    if (!formattedText) {
      return;
    }

    const documentRange = document.validateRange(
      new vscode.Range(0, 0, document.lineCount, Number.MAX_SAFE_INTEGER),
    );
    return [vscode.TextEdit.replace(documentRange, formattedText)];
  }
}

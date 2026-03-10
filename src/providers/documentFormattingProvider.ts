import * as vscode from 'vscode';
import { ExtensionContext } from '../extensionContext';
import { rubyfmt } from '../rubyfmt';

export function registerDocumentFormattingEditProvider(context: ExtensionContext): void {
  context.disposables.push(
    vscode.languages.registerDocumentFormattingEditProvider(
      'ruby',
      new DocumentFormattingEditProvider(context),
    ),
  );
}

export class DocumentFormattingEditProvider implements vscode.DocumentFormattingEditProvider {
  constructor(private readonly context: ExtensionContext) {}

  async provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    _options: vscode.FormattingOptions,
    token: vscode.CancellationToken,
  ): Promise<vscode.TextEdit[] | undefined> {
    const source = document.getText();
    let edits: vscode.TextEdit[] | undefined;

    try {
      const formattedSource = await rubyfmt(this.context, source, token);
      const sourceRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(source.length),
      );
      edits = [vscode.TextEdit.replace(sourceRange, formattedSource)];
    } catch (e) {
      this.context.log.error(e as any);
    }

    return edits;
  }
}

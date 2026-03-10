import * as vscode from 'vscode';
import { ExtensionContext } from '../extensionContext';
import { rubyfmt } from '../rubyfmt';

export function registerRangeFormattingEditProvider(context: ExtensionContext): void {
  context.disposables.push(
    vscode.languages.registerDocumentRangeFormattingEditProvider(
      'ruby',
      new RangeFormattingEditProvider(context),
    ),
  );
}

export class RangeFormattingEditProvider implements vscode.DocumentRangeFormattingEditProvider {
  constructor(private readonly context: ExtensionContext) {}

  async provideDocumentRangeFormattingEdits(
    document: vscode.TextDocument,
    range: vscode.Range,
    _options: vscode.FormattingOptions,
    token: vscode.CancellationToken,
  ): Promise<vscode.TextEdit[] | undefined> {
    const source = document.getText(range);
    let edits: vscode.TextEdit[] | undefined;

    try {
      const formattedSource = await rubyfmt(this.context, source, token);
      edits = [vscode.TextEdit.replace(range, formattedSource)];
    } catch (e) {
      this.context.log.error(e as any);
    }

    return edits;
  }
}

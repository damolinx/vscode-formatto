import * as vscode from 'vscode';
import { ExtensionContext } from '../extensionContext';
import { formatText } from '../rubyfmt';

export function registerRangeFormattingEditProvider(context: ExtensionContext): void {
  context.disposables.push(
    vscode.languages.registerDocumentRangeFormattingEditProvider(
      'ruby',
      new RangeFormattingEditProvider(context),
    ),
  );
}

/**
 * Format a selection in a Ruby document. Range formatting is not supported by
 * `rubyfmt` so this implementation uses the selection as document and adjusts
 * the indentation if `rubyfmt` succeeds.  Experimental.
 */
export class RangeFormattingEditProvider implements vscode.DocumentRangeFormattingEditProvider {
  constructor(private readonly context: ExtensionContext) {}

  async provideDocumentRangeFormattingEdits(
    document: vscode.TextDocument,
    range: vscode.Range,
    _options: vscode.FormattingOptions,
    token: vscode.CancellationToken,
  ): Promise<vscode.TextEdit[] | undefined> {
    const selection = document.getText(range);

    const formattedSource = await formatText(this.context, selection, document.uri, token).catch(
      (reason) => {
        this.context.log.error(
          'Failed to format selection',
          reason,
          vscode.workspace.asRelativePath(document.uri),
        );
        return undefined;
      },
    );
    if (!formattedSource) {
      return;
    }

    const indentation = RangeFormattingEditProvider.getIndentOfFirstNonEmptyLine(document, range);
    if (indentation !== 0) {
      return [
        vscode.TextEdit.replace(
          range,
          RangeFormattingEditProvider.indentText(formattedSource, indentation),
        ),
      ];
    }

    return [vscode.TextEdit.replace(range, formattedSource)];
  }

  private static getIndentOfFirstNonEmptyLine(
    document: vscode.TextDocument,
    range: vscode.Range,
  ): number {
    for (let line = range.start.line; line <= range.end.line; line++) {
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
      .map((line) => spaces + line)
      .join('\n');
  }
}

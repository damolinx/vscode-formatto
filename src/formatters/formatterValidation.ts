import * as vscode from 'vscode';
import { minimatch } from 'minimatch';
import { ExtensionContext } from '../extensionContext';
import { Formatter } from './formatter';

export function validateFormatter(
  context: ExtensionContext,
  formatter: Formatter,
  uri: vscode.Uri,
): string | undefined {
  const { supported, reason } = formatter.supportsUri(uri);
  if (!supported) {
    return reason;
  }

  const excludePatterns = context.configuration.getExcludePatterns(uri);
  if (excludePatterns?.length) {
    const relativePath = vscode.workspace.asRelativePath(uri.fsPath, false);
    if (excludePatterns.some((p) => minimatch(relativePath, p, { dot: true }))) {
      return 'File is excluded';
    }
  }

  return;
}

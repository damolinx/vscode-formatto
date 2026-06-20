import * as vscode from 'vscode';
import { extname } from 'path';
import { minimatch } from 'minimatch';
import { ExtensionContext } from '../extensionContext';
import { Formatter } from './formatter';

export function validateFormatter(
  context: ExtensionContext,
  formatter: Formatter,
  uri: vscode.Uri,
) {
  const ext = extname(uri.fsPath);

  if (!formatter.spec.supportedExtensions.includes(ext)) {
    return 'Unsupported file extension';
  }

  if (isExcluded(context, uri)) {
    return 'File is excluded';
  }

  return;
}

function isExcluded(context: ExtensionContext, uri: vscode.Uri): boolean {
  const patterns = context.configuration.getExcludePatterns(uri) ?? [];
  if (patterns.length === 0) {
    return false;
  }

  const relativePath = vscode.workspace.asRelativePath(uri.fsPath, false);
  return patterns.some((pattern) => minimatch(relativePath, pattern, { dot: true }));
}

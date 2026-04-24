import * as vscode from 'vscode';
import type { Repository } from '../../typings/git';
import type { ExtensionContext } from '../extensionContext';
import { getGitApi } from '../utils/git';
import { normalizeForDisplay } from '../utils/uri';

let activeFormatCts: vscode.CancellationTokenSource | undefined;

export async function formatPendingChanges(context: ExtensionContext): Promise<void> {
  if (activeFormatCts) {
    activeFormatCts.cancel();
  }

  activeFormatCts = new vscode.CancellationTokenSource();
  try {
    await startFormatPendingChanges(context, activeFormatCts.token);
  } finally {
    activeFormatCts = undefined;
  }
}

async function startFormatPendingChanges(
  context: ExtensionContext,
  token: vscode.CancellationToken,
): Promise<void> {
  const api = getGitApi();
  if (!api) {
    const message = 'Git support is unavailable';
    vscode.window.showWarningMessage(message);
    context.log.warn('ChangesFormat:', message);
    return;
  }

  if (api.repositories.length === 0) {
    const message = 'No repositories found in workspace.';
    vscode.window.showWarningMessage(message);
    context.log.info('ChangesFormat:', message);
    return;
  }

  await Promise.allSettled(
    api.repositories.map((repo) =>
      formatRepoPendingChanges(context, repo, normalizeForDisplay(repo.rootUri), token),
    ),
  );
}

async function formatRepoPendingChanges(
  context: ExtensionContext,
  repo: Repository,
  repoDisplayId: string,
  token: vscode.CancellationToken,
): Promise<void> {
  const changed = [...repo.state.workingTreeChanges, ...repo.state.indexChanges];
  const uris = changed.map((change) => change.uri).filter((uri) => uri.fsPath.endsWith('.rb'));
  if (uris.length === 0) {
    context.log.debug(`ChangesFormat: No Ruby changes in '${repoDisplayId}'`);
    return;
  }

  for (const uri of uris) {
    if (token.isCancellationRequested) {
      context.log.debug(`ChangesFormat: Canceled while processing '${repoDisplayId}'`);
      return;
    }

    const formatter = context.formatters.getFor(uri);
    const document = await vscode.workspace.openTextDocument(uri);
    const documentText = document.getText();

    const formattedText = await formatter.tryFormatDocumentText(document, documentText, token);
    if (formattedText !== undefined && formattedText !== documentText) {
      await applyDocumentEdit(document, formattedText);
    }
  }
}

async function applyDocumentEdit(document: vscode.TextDocument, newText: string): Promise<boolean> {
  const fullRange = document.validateRange(
    new vscode.Range(0, 0, document.lineCount, Number.MAX_SAFE_INTEGER),
  );

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, fullRange, newText);
  return vscode.workspace.applyEdit(edit);
}

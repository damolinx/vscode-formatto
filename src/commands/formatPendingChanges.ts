import * as vscode from 'vscode';
import type { Repository } from '../../typings/git';
import type { ExtensionContext } from '../extensionContext';
import { getGitApi } from '../utils/git';
import { normalizeForDisplay } from '../utils/uri';

export async function formatPendingChanges(context: ExtensionContext): Promise<void> {
  const api = getGitApi();
  if (!api) {
    const msg = 'Git support is unavailable';
    vscode.window.showWarningMessage(msg);
    context.log.warn('ChangesFormat:', msg);
    return;
  }

  if (api.repositories.length === 0) {
    const msg = 'No repositories found in workspace.';
    vscode.window.showWarningMessage(msg);
    context.log.info('ChangesFormat:', msg);
    return;
  }

  const { token } = new vscode.CancellationTokenSource();
  await Promise.all(
    api.repositories.map(async (repo) => {
      const repoDisplayId = normalizeForDisplay(repo.rootUri);
      if (token.isCancellationRequested) {
        context.log.debug(`ChangesFormat: Canceled before processing '${repoDisplayId}' repo`);
        return;
      }
      await formatRepoPendingChanges(context, repo, repoDisplayId, token);
    }),
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
      context.log.debug(`ChangesFormat: Canceled while processing '${repoDisplayId}' repo`);
      return;
    }
    const document = await vscode.workspace.openTextDocument(uri);
    const formatter = context.formatters.getFor(document.uri);
    const formatted = await formatter.tryFormatDocument(document, token);
    if (formatted && formatted !== document.getText()) {
      await applyDocumentEdit(document, formatted);
    }
  }
}

async function applyDocumentEdit(document: vscode.TextDocument, newText: string): Promise<boolean> {
  const edit = new vscode.WorkspaceEdit();
  const fullRange = document.validateRange(
    new vscode.Range(0, 0, document.lineCount, Number.MAX_SAFE_INTEGER),
  );

  edit.replace(document.uri, fullRange, newText);
  return vscode.workspace.applyEdit(edit);
}

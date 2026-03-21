import * as vscode from 'vscode';
import type { Repository } from '../../typings/git';
import type { ExtensionContext } from '../extensionContext';
import { tryFormatDocument } from '../rubyfmt';
import { getGitApi } from '../utils/git';

export async function formatPendingChanges(context: ExtensionContext): Promise<void> {
  const api = getGitApi(context);
  if (!api) {
    const msg = 'Git support is unavailable';
    vscode.window.showWarningMessage(msg);
    context.log.debug('Format:', msg);
    return;
  }

  if (api.repositories.length === 0) {
    const msg = 'No repositories found in workspace.';
    vscode.window.showWarningMessage(msg);
    context.log.debug('Format:', msg);
    return;
  }

  const { token } = new vscode.CancellationTokenSource();
  await Promise.all(
    api.repositories.map(async (repo) => {
      const repoId =
        repo.rootUri.scheme === 'file' ? repo.rootUri.fsPath : repo.rootUri.toString(true);

      if (token.isCancellationRequested) {
        context.log.debug('Format: Cancelled by token before processing repo.', repoId);
        return;
      }
      await formatRepoPendingChanges(context, repo, repoId, token);
    }),
  );
}

async function formatRepoPendingChanges(
  context: ExtensionContext,
  repo: Repository,
  repoId: string,
  token: vscode.CancellationToken,
): Promise<void> {
  const changed = [...repo.state.workingTreeChanges, ...repo.state.indexChanges];
  const uris = changed.map((change) => change.uri).filter((uri) => uri.fsPath.endsWith('.rb'));
  if (uris.length === 0) {
    return;
  }

  for (const uri of uris) {
    if (token.isCancellationRequested) {
      context.log.debug('Format: Cancelled by token while processing repo.', repoId);
      return;
    }
    const document = await vscode.workspace.openTextDocument(uri);
    await tryFormatDocument(context, document, token);
  }
}

import * as vscode from 'vscode';
import type { API as GitAPI, Repository } from '../../typings/git';
import type { ExtensionContext } from '../extensionContext';
import { tryFormatDocument } from '../rubyfmt';

let cachedGitApi: GitAPI | false | undefined;

export async function formatPendingChanges(context: ExtensionContext): Promise<void> {
  const api = getGitApi();
  if (!api) {
    vscode.window.showWarningMessage('Git support is unavailable.');
    return;
  }

  if (api.repositories.length === 0) {
    vscode.window.showWarningMessage('No Git repositories found.');
    return;
  }

  const { token } = new vscode.CancellationTokenSource();
  for (const repo of api.repositories) {
    if (token.isCancellationRequested) {
      return;
    }
    await formatRepoPendingChanges(context, repo, token);
  }
}

async function formatRepoPendingChanges(
  context: ExtensionContext,
  repo: Repository,
  token: vscode.CancellationToken,
): Promise<void> {
  const changed = [...repo.state.workingTreeChanges, ...repo.state.indexChanges];
  const uris = changed.map((change) => change.uri).filter((uri) => uri.fsPath.endsWith('.rb'));
  if (uris.length === 0) {
    return;
  }

  for (const uri of uris) {
    if (token.isCancellationRequested) {
      return;
    }
    const document = await vscode.workspace.openTextDocument(uri);
    await tryFormatDocument(context, document, token);
  }
}

function getGitApi(): GitAPI | false {
  if (cachedGitApi !== undefined) {
    return cachedGitApi;
  }

  const gitExtension = vscode.extensions.getExtension('vscode.git');
  if (!gitExtension) {
    cachedGitApi = false;
    return cachedGitApi;
  }

  const git = gitExtension.exports as { getAPI(version: number): GitAPI };
  cachedGitApi = git.getAPI(1);
  return cachedGitApi;
}

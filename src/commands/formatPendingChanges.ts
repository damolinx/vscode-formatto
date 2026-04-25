import * as vscode from 'vscode';
import type { Repository } from '../../typings/git';
import type { ExtensionContext } from '../extensionContext';
import { getGitApi } from '../utils/git';
import { normalizeForDisplay } from '../utils/uri';

let isRunning = false;

export async function formatPendingChanges(context: ExtensionContext): Promise<void> {
  if (isRunning) {
    context.log.warn('FormatPendingChanges: command is already running, ignoring new request');
    return;
  }

  isRunning = true;
  try {
    await startFormatPendingChanges(context);
  } finally {
    isRunning = false;
  }
}

async function startFormatPendingChanges(context: ExtensionContext): Promise<void> {
  const api = getGitApi();
  if (!api) {
    const message = 'Git support is unavailable';
    vscode.window.showWarningMessage(message);
    context.log.warn('FormatPendingChanges:', message);
    return;
  }

  if (api.repositories.length === 0) {
    const message = 'No repositories found in workspace.';
    vscode.window.showWarningMessage(message);
    context.log.info('FormatPendingChanges:', message);
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Format Pending changes',
      cancellable: true,
    },
    async (progress, progressToken) => {
      progress.report({ message: 'Refreshing git status…' });
      const start = Date.now();
      await Promise.race([
        vscode.commands
          .executeCommand('git.refresh')
          .then(() =>
            context.log.info(`FormatPendingChanges: Refresh git status (${Date.now() - start}ms)`),
          ),
        new Promise<void>((resolve) => progressToken.onCancellationRequested(resolve)),
      ]);

      if (progressToken.isCancellationRequested) {
        context.log.info('FormatPendingChanges: Canceled before processing any repo');
        return;
      }

      progress.report({ message: 'Formatting…' });
      await Promise.allSettled(
        api.repositories.map((repo) =>
          formatRepoPendingChanges(context, repo, normalizeForDisplay(repo.rootUri), progressToken),
        ),
      );
    },
  );
}

async function formatRepoPendingChanges(
  context: ExtensionContext,
  repo: Repository,
  repoDisplayId: string,
  token: vscode.CancellationToken,
): Promise<void> {
  const includeStaged = context.configuration.getFormatPendingChangesIncludeStaged(repo.rootUri);
  const changed = includeStaged
    ? [...repo.state.workingTreeChanges, ...repo.state.indexChanges]
    : repo.state.workingTreeChanges;
  const uris = changed.map((change) => change.uri).filter((uri) => uri.fsPath.endsWith('.rb'));
  if (uris.length === 0) {
    context.log.info(`FormatPendingChanges: No Ruby changes in '${repoDisplayId}'`);
    return;
  }

  for (const uri of uris) {
    if (token.isCancellationRequested) {
      context.log.warn(`FormatPendingChanges: Canceled while processing '${repoDisplayId}'`);
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

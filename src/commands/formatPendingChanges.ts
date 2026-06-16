import * as vscode from 'vscode';
import type { Change, Repository } from '../../typings/git';
import type { ExtensionContext } from '../extensionContext';
import { runWithConcurrencyLimit } from '../utils/async';
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
      title: 'Format Pending Changes',
      cancellable: true,
    },
    async (progress, progressToken) => {
      progress.report({ message: 'Checking Git for pending changes…' });

      const start = Date.now();
      await Promise.race([
        vscode.commands
          .executeCommand('git.refresh')
          .then(() =>
            context.log.info(`FormatPendingChanges: git status (${Date.now() - start}ms)`),
          ),
        new Promise<void>((resolve) => progressToken.onCancellationRequested(resolve)),
      ]);

      if (progressToken.isCancellationRequested) {
        context.log.info('FormatPendingChanges: Canceled before processing any repo');
        return;
      }

      progress.report({ message: 'Formatting pending changes…' });

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
  const autoSave = context.configuration.getFormatPendingChangesAutoSave(repo.rootUri);
  const includeStaged = context.configuration.getFormatPendingChangesIncludeStaged(repo.rootUri);

  let uris: vscode.Uri[];
  if (includeStaged) {
    const uniqueChanges = new Map<string, Change>();
    repo.state.indexChanges.forEach((change) => uniqueChanges.set(change.uri.toString(), change));
    repo.state.workingTreeChanges.forEach((change) => uniqueChanges.set(change.uri.toString(), change));
    uris = [...uniqueChanges.values()].map(({ uri }) => uri);
  } else {
    uris = repo.state.workingTreeChanges.map(({ uri }) => uri);
  }

  if (uris.length === 0) {
    context.log.info(`FormatPendingChanges: No changes in '${repoDisplayId}'`);
    return;
  }

  await runWithConcurrencyLimit(uris, 4, async (uri) => {
    if (token.isCancellationRequested) {
      return;
    }

    try {
      const formatter = context.formatters.getFor(uri);
      if (formatter.isExcluded(uri)) {
        context.log.info(`FormatPendingChanges: Skipped excluded file '${uri.fsPath}'`);
        return;
      }

      const document = await vscode.workspace.openTextDocument(uri);
      const formattedText = await formatter.tryFormatDocument(document, token);

      if (formattedText !== undefined) {
        await applyDocumentEdit(document, formattedText);

        if (autoSave) {
          await document.save();
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      context.log.error(`FormatPendingChanges: Error formatting '${uri.fsPath}': ${message}`);
    }
  });
}

async function applyDocumentEdit(document: vscode.TextDocument, newText: string): Promise<boolean> {
  const fullRange = document.validateRange(
    new vscode.Range(0, 0, document.lineCount, Number.MAX_SAFE_INTEGER),
  );

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, fullRange, newText);
  return vscode.workspace.applyEdit(edit);
}
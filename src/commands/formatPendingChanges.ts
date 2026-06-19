import * as vscode from 'vscode';
import { randomUUID } from 'crypto';
import type { Repository } from '../../typings/git';
import type { ExtensionContext } from '../extensionContext';
import { createCancellationPromise, runWithConcurrencyLimit } from '../utils/async';
import { getGitApi } from '../utils/git';
import { verifyFormatterCore } from './verifyFormatter';

let currentSession: string | undefined;

export async function formatPendingChanges(context: ExtensionContext): Promise<void> {
  if (currentSession) {
    context.log.warn(
      `FormatPendingChanges(${currentSession}): command is already running, ignoring new request`,
    );
    return;
  }

  currentSession = randomUUID().slice(0, 8);
  try {
    context.log.info(`FormatPendingChanges(${currentSession}): Session start`);
    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Format Pending Changes',
        cancellable: true,
      },
      (progress, progressToken) => formatPendingChangesCore(context, progress, progressToken),
    );
    if (
      !result &&
      (await vscode.window.showWarningMessage(
        'Not all files were formatted, check logs for details.',
        'Show Logs',
      ))
    ) {
      context.log.show(true);
    }
  } catch (error: any) {
    if (error?.message === 'Cancelled') {
      context.log.info(`FormatPendingChanges(${currentSession}): Operation was cancelled.`);
    } else {
      throw error;
    }
  } finally {
    context.log.info(`FormatPendingChanges(${currentSession}): Session end`);
    currentSession = undefined;
  }
}

async function formatPendingChangesCore(
  context: ExtensionContext,
  progress: vscode.Progress<{ message?: string }>,
  token: vscode.CancellationToken,
): Promise<boolean> {
  const api = getGitApi();
  if (!api) {
    context.log.warn(`FormatPendingChanges(${currentSession}): Git API not available.`);
    return false;
  }

  let succeeded = true;
  if (api.repositories.length === 0) {
    context.log.info(`FormatPendingChanges(${currentSession}): No repositories found in workspace`);
    return succeeded;
  }

  const start = Date.now();
  progress.report({ message: 'Checking Git for pending changes…' });
  context.log.info(
    `FormatPendingChanges(${currentSession}): Git status checked (${Date.now() - start}ms).`,
  );
  const grouped = await groupByWorkspace(api.repositories, token);
  if (grouped.size === 0) {
    context.log.info(`FormatPendingChanges(${currentSession}): No pending changes.`);
    return succeeded;
  }

  for (const { workspaceFolder, uris } of grouped.values()) {
    const workspaceName = workspaceFolder?.name ?? 'no workspace';
    progress.report({ message: `Formatting pending changes for ${workspaceName} files…` });

    const formatter = context.formatters.getFor(workspaceFolder);
    if (!formatter || !(await verifyFormatterCore(context, formatter, workspaceFolder?.uri))) {
      context.log.warn(
        `FormatPendingChanges(${currentSession}): No formatter available for ${workspaceName} files, skipping.`,
      );
      succeeded = false;
      continue;
    }

    const options = {
      save: context.configuration.getFormatPendingChangesAutoSave(workspaceFolder),
    };
    await runWithConcurrencyLimit(
      uris,
      formatter.maxConcurrency,
      (uri) => formatPendingChange(context, uri, options, token),
      token,
    );
  }

  return succeeded;
}

async function formatPendingChange(
  context: ExtensionContext,
  uri: vscode.Uri,
  options: { save: boolean },
  token: vscode.CancellationToken,
): Promise<void> {
  if (token.isCancellationRequested) {
    return;
  }

  try {
    const { formatter, reason } = context.formatters.resolveFor(uri);
    if (!formatter) {
      context.log.warn(`FormatPendingChanges(${currentSession}): ${reason}. ${uri.fsPath}`);
      return;
    }

    const document = await vscode.workspace.openTextDocument(uri);
    const formattedText = await formatter.tryFormatDocument(document, token);

    if (formattedText !== undefined) {
      await applyDocumentEdit(document, formattedText);
      if (options.save) {
        await document.save();
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    context.log.error(`FormatPendingChanges(${currentSession}): ${message}. ${uri.fsPath}`);
  }
}

async function groupByWorkspace(
  repositories: Repository[],
  token: vscode.CancellationToken,
): Promise<Map<string, { workspaceFolder?: vscode.WorkspaceFolder; uris: vscode.Uri[] }>> {
  const workspaceToFilesMap = new Map<
    string,
    { workspaceFolder?: vscode.WorkspaceFolder; uris: vscode.Uri[] }
  >();

  await Promise.race([
    Promise.all(repositories.map((repo) => repo.status())),
    createCancellationPromise(token),
  ]);
  if (token.isCancellationRequested) {
    throw new Error('Cancelled');
  }

  for (const {
    state: { indexChanges, workingTreeChanges },
  } of repositories) {
    const uris = new Map(indexChanges.map(({ uri }) => [uri.toString(), uri]));
    workingTreeChanges.forEach(({ uri }) => uris.set(uri.toString(), uri));

    for (const uri of uris.values()) {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
      const key = workspaceFolder?.uri?.toString() ?? 'no-workspace';
      let group = workspaceToFilesMap.get(key);
      if (!group) {
        group = { workspaceFolder, uris: [] };
        workspaceToFilesMap.set(key, group);
      }
      group.uris.push(uri);
    }
  }
  return workspaceToFilesMap;
}

async function applyDocumentEdit(document: vscode.TextDocument, newText: string): Promise<boolean> {
  const fullRange = document.validateRange(
    new vscode.Range(0, 0, document.lineCount, Number.MAX_SAFE_INTEGER),
  );

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, fullRange, newText);
  return vscode.workspace.applyEdit(edit);
}

import * as vscode from 'vscode';
import { randomUUID } from 'crypto';
import type { Repository } from '../../typings/git';
import type { ExtensionContext } from '../extensionContext';
import { Formatter } from '../formatters/formatter';
import { validateFormatter } from '../formatters/formatterValidation';
import { CancellationError, createCancellationPromise } from '../utils/async';
import { getGitApi } from '../utils/git';
import { verifyFormatterCore } from './verifyFormatter';

let currentSession: string | undefined;

export async function formatPendingChanges(context: ExtensionContext): Promise<void> {
  if (currentSession) {
    context.log.warn(
      `FormatPendingChanges(${currentSession}): Command is already running, ignoring new request`,
    );
    return;
  }

  let result = true;
  currentSession = randomUUID().slice(0, 8);
  try {
    context.log.info(`FormatPendingChanges(${currentSession}): Session start`);
    result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        cancellable: true,
      },
      (progress, progressToken) => formatPendingChangesCore(context, progress, progressToken),
    );
  } catch (error: any) {
    if (error instanceof CancellationError) {
      context.log.info(`FormatPendingChanges(${currentSession}): ${error.message}`);
    } else {
      throw error;
    }
  } finally {
    context.log.info(`FormatPendingChanges(${currentSession}): Session end`);
    currentSession = undefined;
  }

  if (!result) {
    vscode.window
      .showWarningMessage(
        'Not all files were formatted, check logs for error details.',
        'Show Logs',
      )
      .then((selection) => {
        if (selection) {
          context.log.show(true);
        }
      });
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
  const grouped = await groupByWorkspace(api.repositories, token);
  context.log.info(
    `FormatPendingChanges(${currentSession}): Git status completed (${Date.now() - start}ms).`,
  );
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

    succeeded &&= await formatWorkspace(context, formatter, workspaceFolder, uris, token);
  }

  return succeeded;
}

async function formatWorkspace(
  context: ExtensionContext,
  formatter: Formatter,
  workspaceFolder: vscode.WorkspaceFolder | undefined,
  uris: vscode.Uri[],
  token: vscode.CancellationToken,
): Promise<boolean> {
  const targetUris = uris.filter((uri) => {
    const reason = validateFormatter(context, formatter, uri);
    if (reason === undefined) {
      return true;
    }
    context.log.trace(
      `FormatPendingChanges(${currentSession}): Skipping ${uri.fsPath}. Reason: ${reason}`,
    );
    return false;
  });
  context.log.info(
    `FormatPendingChanges(${currentSession}): ` +
      (workspaceFolder ? `${workspaceFolder.name}: ` : '') +
      `${targetUris.length} files selected, ` +
      `${uris.length - targetUris.length} skipped.`,
  );
  if (targetUris.length === 0) {
    return true;
  }

  let succeeded: boolean;
  try {
    await formatter.formatFiles(workspaceFolder, targetUris, token);
    succeeded = true;
  } catch (error) {
    context.log.error(
      `FormatPendingChanges(${currentSession}): Failed to format workspace${workspaceFolder ? ` ${workspaceFolder.uri.fsPath}` : ''}`,
      error,
    );
    succeeded = false;
  }
  return succeeded;
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
    throw new CancellationError();
  }

  for (const {
    state: { indexChanges, workingTreeChanges },
  } of repositories) {
    const uris = new Map(indexChanges.map(({ uri }) => [uri.toString(), uri]));
    workingTreeChanges.forEach(({ uri }) => uris.set(uri.toString(), uri));

    for (const uri of uris.values()) {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
      const key = workspaceFolder?.uri.toString() ?? 'no-workspace';
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

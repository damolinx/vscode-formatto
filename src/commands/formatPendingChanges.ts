import * as vscode from 'vscode';
import { randomUUID } from 'crypto';
import type { Repository } from '../../typings/git';
import type { ExtensionContext } from '../extensionContext';
import { Formatter } from '../formatters/formatter';
import { validateFormatter } from '../formatters/formatterValidation';
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

  let result = true;
  currentSession = randomUUID().slice(0, 8);
  try {
    context.log.info(`FormatPendingChanges(${currentSession}): Session start`);
    result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Format Pending Changes',
        cancellable: true,
      },
      (progress, progressToken) => formatPendingChangesCore(context, progress, progressToken),
    );
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
  const options = {
    save: context.configuration.getFormatPendingChangesAutoSave(workspaceFolder),
  };

  const targetUris = uris.filter((uri) => {
    const reason = validateFormatter(context, formatter, uri);
    if (reason === undefined) {
      return true;
    }
    context.log.warn(`FormatPendingChanges(${currentSession}): ${reason}, skipping. ${uri.fsPath}`);
    return false;
  });

  let succeeded = true;
  await runWithConcurrencyLimit(
    targetUris,
    context.configuration.getMaxConcurrency(formatter.spec.id),
    (uri) =>
      formatPendingChange(context, formatter, uri, options, token).then((value) => {
        succeeded &&= value;
      }),
    token,
  );

  return succeeded;
}

async function formatPendingChange(
  context: ExtensionContext,
  formatter: Formatter,
  uri: vscode.Uri,
  options: { save: boolean },
  token: vscode.CancellationToken,
): Promise<boolean> {
  let succeeded = true;
  try {
    const document = await vscode.workspace.openTextDocument(uri);
    const formattingEdit = await formatter.formatDocument(document, undefined, token);
    if (!formattingEdit) {
      context.log.debug(
        `FormatPendingChanges(${currentSession}): No changes to apply. ${uri.fsPath}`,
      );
      return succeeded;
    }

    const edit = new vscode.WorkspaceEdit();
    edit.set(uri, [formattingEdit]);
    if (await vscode.workspace.applyEdit(edit)) {
      if (options.save) {
        await document.save();
      }
    }
  } catch (error) {
    context.log.error(`FormatPendingChanges(${currentSession}): ${error}. ${uri.fsPath}`);
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

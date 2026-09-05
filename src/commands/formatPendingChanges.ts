import * as vscode from 'vscode';
import { randomUUID } from 'crypto';
import type { Repository } from '../../typings/git';
import type { ExtensionContext } from '../extensionContext';
import { Formatter } from '../formatters/formatter';
import { validateFormatter } from '../formatters/formatterValidation';
import { CancellationError, createCancellationPromise } from '../utils/async';
import { getGitApi } from '../utils/git';
import { verifyFormatterCore } from './verifyFormatter';

const NO_WORKSPACE_KEY = '__no_workspace__';
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
  const sessionId = currentSession;

  try {
    context.log.info(`FormatPendingChanges(${sessionId}): Session start`);
    result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        cancellable: true,
      },
      (progress, progressToken) =>
        formatPendingChangesCore(context, sessionId, progress, progressToken),
    );
  } catch (error: any) {
    if (error instanceof CancellationError) {
      context.log.info(`FormatPendingChanges(${sessionId}): ${error.message}`);
    } else {
      throw error;
    }
  } finally {
    context.log.info(`FormatPendingChanges(${sessionId}): Session end`);
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
  sessionId: string,
  progress: vscode.Progress<{ message?: string }>,
  token: vscode.CancellationToken,
): Promise<boolean> {
  const api = getGitApi();
  if (!api) {
    context.log.warn(`FormatPendingChanges(${sessionId}): Git API not available`);
    return false;
  }

  let succeeded = true;
  if (api.repositories.length === 0) {
    context.log.info(`FormatPendingChanges(${sessionId}): No repositories found`);
    return succeeded;
  }

  const start = Date.now();
  progress.report({ message: 'Checking for uncommitted changes' });
  const grouped = await groupByWorkspace(api.repositories, token);
  context.log.info(
    `FormatPendingChanges(${sessionId}): Git status completed (${Date.now() - start}ms)`,
  );
  if (grouped.size === 0) {
    context.log.info(`FormatPendingChanges(${sessionId}): No uncommitted changes`);
    return succeeded;
  }

  for (const { workspaceFolder, uris } of grouped.values()) {
    if (token.isCancellationRequested) {
      throw new CancellationError();
    }

    progress.report({
      message: `Formatting ${uris.length} changed file(s)${workspaceFolder ? ` in '${workspaceFolder.name}'` : ''}`,
    });

    const formatter = context.formatters.getFor(workspaceFolder);
    if (!formatter) {
      context.log.warn(
        `FormatPendingChanges(${sessionId}): ${
          workspaceFolder
            ? `No formatter configured for '${workspaceFolder.name}'`
            : 'No default formatter configured'
        }, skipping`,
      );
      succeeded = false;
      continue;
    }

    if (!(await verifyFormatterCore(context, formatter, workspaceFolder?.uri))) {
      context.log.warn(
        `FormatPendingChanges(${sessionId}): Formatter '${formatter.spec.id}' not available${
          workspaceFolder ? ` for '${workspaceFolder.name}'` : ''
        }, skipping`,
      );
      succeeded = false;
      continue;
    }

    const workspaceSucceeded = await formatWorkspace(
      context,
      sessionId,
      formatter,
      workspaceFolder,
      uris,
      token,
    );
    succeeded &&= workspaceSucceeded;
  }

  return succeeded;
}

async function formatWorkspace(
  context: ExtensionContext,
  sessionId: string,
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
      `FormatPendingChanges(${sessionId}): Skipping ${uri.fsPath}. Reason: ${reason}`,
    );
    return false;
  });
  context.log.info(
    `FormatPendingChanges(${sessionId}): ` +
      (workspaceFolder ? `${workspaceFolder.name}: ` : '') +
      `${targetUris.length} selected, ` +
      `${uris.length - targetUris.length} skipped`,
  );
  if (targetUris.length === 0) {
    return true;
  }

  try {
    await formatter.formatFiles(workspaceFolder, targetUris, token);
    return true;
  } catch (error) {
    context.log.error(
      `FormatPendingChanges(${sessionId}): Failed to format workspace${workspaceFolder ? ` ${workspaceFolder.uri.fsPath}` : ''}`,
      error,
    );
    return false;
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
    throw new CancellationError();
  }

  for (const {
    state: { indexChanges, workingTreeChanges },
  } of repositories) {
    const uris = new Map(indexChanges.map(({ uri }) => [uri.toString(), uri]));
    workingTreeChanges.forEach(({ uri }) => uris.set(uri.toString(), uri));

    for (const uri of uris.values()) {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
      const key = workspaceFolder?.uri.toString() ?? NO_WORKSPACE_KEY;
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

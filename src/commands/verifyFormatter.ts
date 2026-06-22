import * as vscode from 'vscode';
import { ExtensionContext } from '../extensionContext';
import { Formatter } from '../formatters/formatter';
import { FormatterId } from '../formatters/formatterId';
import { FormatterSpec } from '../formatters/formatterSpec';

const verified = new Map<string, string>();

export async function verifyFormatter(
  context: ExtensionContext,
  options?: { forceVerification?: true },
) {
  let folder: vscode.WorkspaceFolder | undefined;
  const folders = vscode.workspace.workspaceFolders;
  switch (folders?.length) {
    case undefined:
    case 0:
      context.log.debug('Verify: No workspace folders open, using global formatter');
      break;

    case 1:
      folder = folders[0];
      context.log.debug(`Verify: Auto-selected workspace: ${folder.name}`);
      break;

    default:
      folder = await vscode.window.showWorkspaceFolderPick({
        placeHolder: 'Select a workspace folder to verify the formatter',
      });
      if (!folder) {
        return;
      }
      context.log.debug(`Verify: Selected workspace: ${folder.name}`);
      break;
  }

  const formatter = context.formatters.getFor(folder);
  const result = await verifyFormatterCore(context, formatter, folder?.uri, options);
  if (result) {
    vscode.window.showInformationMessage(
      `Found '${result.spec.name}' version ${result.version}${folder ? ` for '${folder.name}' workspace.` : ''}`,
    );
  }
}

export async function verifyFormatterCore(
  context: ExtensionContext,
  formatter: Formatter,
  uri?: vscode.Uri,
  options?: { forceVerification?: true },
): Promise<{ spec: FormatterSpec; version: string } | undefined> {
  const { spec } = formatter;
  const command = formatter.buildVersionCommand(uri);
  const verificationCacheKey = getVerificationCacheKey(spec, [command.cmd, ...command.args]);

  if (options?.forceVerification) {
    verified.delete(verificationCacheKey);
  } else if (verified.has(verificationCacheKey)) {
    context.log.trace(`${spec.id}: Skipped verification (already verified)`);
    return { spec, version: verified.get(verificationCacheKey)! };
  } else if (!context.configuration.shouldVerifyFormatter(spec.id)) {
    context.log.trace(`${spec.id}: Skipped verification (disabled by setting)`);
    return { spec, version: '' };
  }

  const { error, version } = await formatter.getVersion(command.cmd, command.cwd, command.args);
  if (version !== undefined) {
    const normalizedVersion = normalizeVersion(version, spec.id);
    verified.set(verificationCacheKey, normalizedVersion);
    context.log.info(`${spec.id}: Version: ${normalizedVersion}`);
    return { spec, version: normalizedVersion };
  }

  context.log.error(
    `${spec.id}: ${getErrorMessage(error)}${command.cwd ? ` Cwd: ${command.cwd}` : ''}`,
  );
  const message =
    command.cmd === 'bundle'
      ? 'Check your Gemfile and ensure the formatter gem is installed.'
      : 'The formatter may be missing or incompatible with this system.';
  const items = spec.docs.installation
    ? ['Show Logs', 'Documentation', "Don't ask again"]
    : ['Show Logs', "Don't ask again"];

  const selection = await vscode.window.showWarningMessage(
    `Failed to run '${spec.name}'. ${message}`,
    ...items,
  );

  switch (selection) {
    case 'Documentation':
      vscode.env.openExternal(vscode.Uri.parse(spec.docs.installation!));
      break;

    case "Don't ask again":
      await context.configuration.updateVerifyFormatter(spec.id, false);
      context.log.warn(
        `Verify(${spec.id}): Verification disabled via ${context.configuration.verifyFormatterKey(spec.id, true)} setting.`,
      );
      break;

    case 'Show Logs':
      context.log.show(true);
      break;
  }

  return;
}

function getErrorMessage(error: Error & { code: string; path: string }): string {
  switch (error.code) {
    case 'ENOENT':
      return `Command not found: ${error.path} (${error.code})`;
    case 'EACCES':
      return `Permission denied when executing: ${error.path} (${error.code})`;
    case 'ETIMEDOUT':
      return `The command timed out (${error.code})`;
    case 'EPIPE':
      return `The process exited unexpectedly (${error.code})`;
    default:
      return error.message;
  }
}

function getVerificationCacheKey(spec: FormatterSpec, command: string[]) {
  return `${spec.id}:${command.join(':')}`;
}

function normalizeVersion(raw: string, formatterId: FormatterId): string {
  const prefix = formatterId + ' ';
  return raw.startsWith(prefix) ? raw.slice(prefix.length).trim() : raw.trim();
}

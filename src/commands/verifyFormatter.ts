import * as vscode from 'vscode';
import { ExtensionContext } from '../extensionContext';
import { Formatter } from '../formatters/formatter';
import { FormatterId } from '../formatters/formatterId';
import { FormatterSpec } from '../formatters/formatterSpec';

type VerificationCacheKey = string & {
  readonly __verificationCacheKey: unique symbol;
};
const verifiedVersions = new Map<VerificationCacheKey, string>();

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
      `Found '${result.spec.name}' version ${result.version}${folder ? ` for workspace '${folder.name}'` : ''}`,
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
  const { cmd, args, cwd } = formatter.buildVersionCommand(uri);
  const verifiedKey = getVerificationCacheKey(spec, { cmd, args, cwd });

  if (options?.forceVerification) {
    verifiedVersions.delete(verifiedKey);
  } else if (verifiedVersions.has(verifiedKey)) {
    context.log.trace(`${spec.id}: Skipped verification (already verified)`);
    return { spec, version: verifiedVersions.get(verifiedKey)! };
  } else if (!context.configuration.shouldVerifyFormatter(spec.id)) {
    context.log.trace(`${spec.id}: Skipped verification (disabled by setting)`);
    return { spec, version: '' };
  }

  const { error, version } = await formatter.getVersion(cmd, cwd, args);
  if (version !== undefined) {
    const normalizedVersion = normalizeVersion(version, spec.id);
    verifiedVersions.set(verifiedKey, normalizedVersion);
    context.log.info(`${spec.id}: Version: ${normalizedVersion}`);
    return { spec, version: normalizedVersion };
  }

  context.log.error(`${spec.id}: ${getErrorMessage(error)}${cwd ? ` Cwd: ${cwd}` : ''}`);
  const message =
    cmd === 'bundle'
      ? 'Check your Gemfile and ensure the formatter gem is installed.'
      : 'The formatter may be missing or incompatible with this system.';
  const items = spec.docs.installation
    ? ['Show Logs', 'Documentation', "Don't ask again"]
    : ['Show Logs', "Don't ask again"];

  // DO NOT await, otherwise it locks callers
  vscode.window
    .showWarningMessage(`Failed to run '${spec.name}'. ${message}`, ...items)
    .then(async (selection) => {
      switch (selection) {
        case 'Documentation':
          void vscode.env.openExternal(vscode.Uri.parse(spec.docs.installation!));
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
    });

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

function getVerificationCacheKey(
  spec: FormatterSpec,
  { cmd, args, cwd }: { cmd: string; args: string[]; cwd?: string },
): VerificationCacheKey {
  return `${spec.id}:${cwd ?? ''}:${cmd}:${args.join(':')}` as VerificationCacheKey;
}

function normalizeVersion(raw: string, formatterId: FormatterId): string {
  const prefix = formatterId + ' ';
  return raw.startsWith(prefix) ? raw.slice(prefix.length).trim() : raw.trim();
}

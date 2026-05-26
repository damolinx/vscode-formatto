import * as vscode from 'vscode';
import { execFile, ExecFileException } from 'child_process';
import { ExtensionContext } from '../extensionContext';
import { Formatter } from '../formatters/formatter';
import { FormatterName } from '../formatters/formatterName';
import { FormatterSpec } from '../formatters/formatterSpec';

const verified = new Map<string, string>();

export async function verifyFormatter(
  context: ExtensionContext,
  formatter?: Formatter,
  scope?: vscode.ConfigurationScope,
  options?: { forceVerification?: true },
) {
  let targetScope = scope;
  if (!targetScope) {
    const folders = vscode.workspace.workspaceFolders;

    switch (folders?.length) {
      case undefined:
      case 0:
        context.log.debug('Verify: No workspace folders open, using global formatter');
        break;

      case 1:
        targetScope = folders[0];
        context.log.debug(`Verify: Auto-selected workspace: ${targetScope.name}`);
        break;

      default:
        targetScope = await vscode.window.showWorkspaceFolderPick({
          placeHolder: 'Select a workspace folder to verify the formatter',
        });
        if (!targetScope) {
          return;
        }
        context.log.debug(`Verify: Selected workspace: ${targetScope.name}`);
        break;
    }
  }

  const targetUri = targetScope instanceof vscode.Uri ? targetScope : targetScope?.uri;
  const targetFormatter = formatter ?? context.formatters.getFor(targetScope);
  const result = await verifyFormatterCore(context, targetFormatter, targetUri, options);
  if (result) {
    vscode.window.showInformationMessage(`Found '${result.spec.name}' version ${result.version}`);
  }
}

export async function verifyFormatterCore(
  context: ExtensionContext,
  formatter: Formatter,
  uri?: vscode.Uri,
  options?: { forceVerification?: true },
): Promise<{ spec: FormatterSpec; version: string } | undefined> {
  const { spec } = formatter;
  const command = formatter.getFormatterCommand(uri);
  const verificationCacheKey = getVerificationCacheKey(spec, command);

  if (options?.forceVerification) {
    verified.delete(verificationCacheKey);
  } else if (!context.configuration.shouldVerifyFormatter(spec.name)) {
    context.log.info(`${spec.name}: Skipped verification (disabled by setting)`);
    return { spec, version: '' };
  } else if (verified.has(verificationCacheKey)) {
    context.log.debug(`${spec.name}: Skipped verification (already verified)`);
    return { spec, version: verified.get(verificationCacheKey)! };
  }

  const [cmd, ...args] = command;
  if (spec.versionArgs?.length) {
    args.push(...spec.versionArgs);
  }
  const cwd = uri && formatter.getCwd(uri);
  const result = await isAvailable(cmd, cwd, args, spec.timeouts?.verificationMs);
  if ('version' in result) {
    const version = normalizeVersion(result.version, spec.name);
    verified.set(verificationCacheKey, version);
    context.log.info(`${spec.name}: Version: ${version}`);
    return { spec, version };
  }

  context.log.error(`${spec.name}: ${getErrorMessage(result.error)}${cwd ? ` Cwd: ${cwd}}` : ''}`);
  const message =
    cmd === 'bundle'
      ? 'Check your Gemfile and ensure the formatter gem is installed.'
      : 'The formatter may be missing or incompatible with this system.';
  const items = spec.docs?.installation
    ? ['Show Logs', 'Documentation', "Don't ask again"]
    : ['Show Logs', "Don't ask again"];

  const selection = await vscode.window.showWarningMessage(
    `Failed to run '${spec.name}'. ${message}`,
    ...items,
  );

  switch (selection) {
    case 'Documentation':
      vscode.env.openExternal(vscode.Uri.parse(spec.docs!.installation!));
      break;

    case "Don't ask again":
      await context.configuration.updateVerifyFormatter(spec.name, false);
      context.log.warn(
        `Verify(${spec.name}): Verification disabled via ${context.configuration.verifyFormatterKey(spec.name, true)} setting.`,
      );
      break;

    case 'Show Logs':
      context.log.show(true);
      break;
  }

  return;
}

function getErrorMessage(err: ExecFileException): string {
  switch (err.code) {
    case 'ENOENT':
      return `Command not found: ${err.path} (${err.code})`;
    case 'EACCES':
      return `Permission denied when executing: ${err.path} (${err.code})`;
    case 'ETIMEDOUT':
      return `The command timed out (${err.code})`;
    case 'EPIPE':
      return `The process exited unexpectedly (${err.code})`;
    default:
      return err.message;
  }
}

function getVerificationCacheKey(spec: FormatterSpec, command: string[]) {
  return `${spec.name}:${command.join(':')}`;
}

async function isAvailable(
  cmd: string,
  cwd?: string,
  args: string[] = [],
  timeout = 1000,
): Promise<{ error: ExecFileException } | { version: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd, timeout }, (error, stdout) => {
      if (error) {
        if (error.killed) {
          resolve({
            error: new Error(
              `Command was killed: ${cmd}${args.length ? ` ${args.join(' ')}` : ''}`,
              { cause: error },
            ),
          });
        } else {
          resolve({ error });
        }
      } else {
        resolve({ version: stdout?.trim() || 'unknown' });
      }
    });
  });
}

function normalizeVersion(raw: string, formatterName: FormatterName): string {
  const prefix = formatterName + ' ';
  return raw.startsWith(prefix) ? raw.slice(prefix.length).trim() : raw.trim();
}

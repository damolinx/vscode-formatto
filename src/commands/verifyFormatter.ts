import * as vscode from 'vscode';
import { execFile, ExecFileException } from 'child_process';
import { ExtensionContext } from '../extensionContext';
import { Formatter } from '../formatters/formatter';
import { FormatterName } from '../formatters/formatterName';

const verified = new Set<string>();

export async function verifyFormatter(
  context: ExtensionContext,
  scope: vscode.Uri,
  formatterOrName: Formatter | FormatterName,
): Promise<boolean> {
  const formatter =
    formatterOrName instanceof Formatter
      ? formatterOrName
      : context.formatters.get(formatterOrName);
  const { spec } = formatter;
  if (!context.configuration.shouldVerifyFormatter(spec.name)) {
    context.log.info(`Verify(${spec.name}): Skipped verification (disabled by setting)`);
    return true;
  }

  const command = formatter.getFormatterCommand(scope);
  const verificationCacheKey = `${spec.name}:${command.join(':')}`;
  if (verified.has(verificationCacheKey)) {
    context.log.debug(`Verify(${spec.name}): Skipped verification (already verified)`);
    return true;
  }

  const [cmd, ...args] = command;
  if (spec.versionArgs?.length) {
    args.push(...spec.versionArgs);
  }
  const cwd = formatter.getCwd(scope);
  const result = await isAvailable(cmd, cwd, args, spec.timeouts?.verificationMs);
  if ('version' in result) {
    verified.add(verificationCacheKey);
    context.log.info(`Verify(${spec.name}): Version: ${result.version}`);
    return true;
  }

  context.log.error(`Verify(${spec.name}): ${result.error.message}`);
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

  return false;
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

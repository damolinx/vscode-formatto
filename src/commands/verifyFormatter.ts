import * as vscode from 'vscode';
import { execFile, ExecFileException } from 'child_process';
import { ExtensionContext } from '../extensionContext';
import { Formatter } from '../formatters/formatter';
import { FormatterName } from '../formatters/types';

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
  const { descriptor } = formatter;
  if (!context.configuration.shouldVerifyFormatter(descriptor.id)) {
    context.log.info(`Verify(${descriptor.id}): Skipped verification (disabled by setting)`);
    return true;
  }

  const command = formatter.getFormatterCommand(scope);
  const verificationCacheKey = `${descriptor.id}:${command.join(':')}`;
  if (verified.has(verificationCacheKey)) {
    context.log.debug(`Verify(${descriptor.id}): Skipped verification (already verified)`);
    return true;
  }

  const [cmd, ...args] = command;
  if (descriptor.versionArgs?.length) {
    args.push(...descriptor.versionArgs);
  }
  const cwd = formatter.getCwd(scope);
  const result = await isAvailable(cmd, cwd, args);
  if ('version' in result) {
    verified.add(verificationCacheKey);
    context.log.info(`Verify(${descriptor.id}): Version: ${result.version}`);
    return true;
  }

  context.log.error(`Verify(${descriptor.id}): ${result.error.message}`);
  const message =
    cmd === 'bundle'
      ? 'Check your Gemfile and ensure the formatter gem is installed.'
      : 'The formatter may be missing or incompatible with this system.';
  const selection = await vscode.window.showWarningMessage(
    `Failed to run '${descriptor.id}'. ${message}`,
    'Show Logs',
    'Documentation',
    "Don't ask again",
  );

  switch (selection) {
    case 'Documentation':
      vscode.env.openExternal(vscode.Uri.parse(descriptor.installUrl));
      break;

    case "Don't ask again":
      await context.configuration.updateVerifyFormatter(descriptor.id, false);
      context.log.warn(
        `Verify(${descriptor.id}): Verification disabled via ${context.configuration.verifyFormatterKey(descriptor.id, true)} setting.`,
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
): Promise<{ error: ExecFileException } | { version: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd, timeout: 5000 }, (error, stdout) => {
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

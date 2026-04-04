import * as vscode from 'vscode';
import { execFile, ExecFileException } from 'child_process';
import { ExtensionContext } from '../extensionContext';
import { FormatterOptions } from '../formatters/formatter';
import { FormatterDescriptor, FormatterName } from '../formatters/types';

const verified = new Set<FormatterName>();

export async function verifyFormatter(
  context: ExtensionContext,
  scope: vscode.Uri,
  options: FormatterOptions & { cwd: string },
  descriptor: FormatterDescriptor,
): Promise<boolean> {
  if (!context.configuration.shouldVerifyFormatter(descriptor.id)) {
    context.log.info(`Verify(${descriptor.id}): Skipped verification (disabled by user setting)`);
    return true;
  }

  if (verified.has(descriptor.id)) {
    context.log.debug(`Verify(${descriptor.id}): Skipped verification (already verified)`);
    return true;
  }

  const resolvedCmd = options.cmd ?? context.configuration.getFormatterPath(descriptor.id, scope);
  const result = await isAvailable(resolvedCmd, options.cwd, descriptor.versionArgs);
  if (result.version) {
    verified.add(descriptor.id);
    context.log.info(`${descriptor.id}: ${resolvedCmd} - Version: ${result.version}`);
    return true;
  }

  const code = result.error?.code ?? result.error?.name ?? 'unknown';
  const message = result.error?.message ? `: ${result.error.message}` : '';
  context.log.error(`Verify: ${resolvedCmd} - ${code}${message}`);

  const selection = await vscode.window.showWarningMessage(
    `Could not run formatter '${resolvedCmd}'. The formatter may be missing or incompatible with this system.`,
    'Install',
    'Configure',
    "Don't ask again",
  );

  switch (selection) {
    case 'Install':
      vscode.env.openExternal(vscode.Uri.parse(descriptor.installUrl));
      break;

    case 'Configure':
      vscode.commands.executeCommand(
        'workbench.action.openSettings',
        context.configuration.formatterPathKey(descriptor.id),
      );
      break;

    case "Don't ask again":
      await context.configuration.updateVerifyFormatter(descriptor.id, false);
      context.log.info(
        `Verify(${descriptor.id}): Disabled by ${context.configuration.verifyFormatterKey(descriptor.id, true)} setting.`,
      );
      break;
  }

  return false;
}

async function isAvailable(
  cmd: string,
  cwd?: string,
  args: string[] = [],
): Promise<{ error?: ExecFileException; version?: string }> {
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

import * as vscode from 'vscode';
import { execFile, ExecFileException } from 'child_process';
import { ExtensionContext } from '../extensionContext';
import { FormatterOptions } from '../formatters/formatter';
import { FormatterDescriptor } from '../formatters/types';

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

  const resolvedCmd = options.cmd ?? context.configuration.getFormatterPath(descriptor.id, scope);

  const result = await isAvailable(resolvedCmd, options.cwd, descriptor.versionArgs);
  if (result.version) {
    context.log.info(`${descriptor.id}: ${resolvedCmd} - Version: ${result.version}`);
    return true;
  }

  const code = result.error?.code ?? result.error?.name ?? 'unknown';
  const message = result.error?.message ? `: ${result.error.message}` : '';
  context.log.error(`Verify(${descriptor.id}): ${resolvedCmd} - Error: ${code}${message}`);

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
  command: string,
  cwd?: string,
  args: string[] = [],
): Promise<{ error?: ExecFileException; version?: string }> {
  return new Promise((resolve) => {
    execFile(command, args, { cwd }, (error, stdout) => {
      if (error) {
        resolve({ error });
      } else {
        resolve({ version: stdout?.trim() || 'unknown' });
      }
    });
  });
}

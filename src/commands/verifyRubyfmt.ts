import * as vscode from 'vscode';
import { execFile, ExecFileException } from 'child_process';
import { ExtensionContext } from '../extensionContext';

export interface VerifyRubyfmtOptions {
  resolvedRubyfmtPath?: string;
  cwd?: string;
  scope?: vscode.Uri;
}

let lastSeenRubyfmtVersion: string | undefined;

export async function verifyRubyfmt(
  context: ExtensionContext,
  options: VerifyRubyfmtOptions,
): Promise<boolean> {
  if (!context.configuration.verifyRubyfmt) {
    return true;
  }

  const resolvedRubyfmtPath =
    options.resolvedRubyfmtPath ?? context.configuration.getRubyfmtPath(options.scope);

  const cwd =
    options.cwd ??
    (options.scope ? vscode.workspace.getWorkspaceFolder(options.scope)?.uri.fsPath : undefined);

  const result = await isAvailable(resolvedRubyfmtPath, cwd);
  if (result.version !== undefined) {
    if (result.version !== lastSeenRubyfmtVersion) {
      lastSeenRubyfmtVersion = result.version;
      context.log.info(`rubyfmt: ${resolvedRubyfmtPath} (version ${result.version})`);
    }
    return true;
  }

  lastSeenRubyfmtVersion = undefined;
  context.log.error(
    `rubyfmt: ${resolvedRubyfmtPath} (${result.error?.code || result.error?.name})`,
  );

  const selection = await vscode.window.showWarningMessage(
    `rubyfmt could not be run at '${resolvedRubyfmtPath}'. It may be missing or incompatible with this system.`,
    'Install',
    'Configure',
    "Don't ask again",
  );

  switch (selection) {
    case 'Install':
      vscode.env.openExternal(
        vscode.Uri.parse('https://github.com/fables-tales/rubyfmt?tab=readme-ov-file#installation'),
      );
      break;

    case 'Configure':
      vscode.commands.executeCommand('workbench.action.openSettings', 'formatto.rubyfmtPath');
      break;

    case "Don't ask again":
      await context.configuration.updateVerifyRubyfmt(false);
      break;
  }

  return false;
}

async function isAvailable(
  command: string,
  cwd?: string,
): Promise<{ error?: ExecFileException; version?: string }> {
  return new Promise((resolve) => {
    execFile(command, ['--version'], { cwd }, (error, stdout) => {
      if (error) {
        resolve({ error });
      } else {
        const version = stdout?.trim() || 'unknown';
        resolve({ version });
      }
    });
  });
}

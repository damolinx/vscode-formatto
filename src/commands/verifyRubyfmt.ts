import * as vscode from 'vscode';
import { exec } from 'child_process';
import { ExtensionContext } from '../extensionContext';

export interface VerifyRubyfmtOptions {
  resolvedRubyfmtPath?: string;
  cwd?: string;
  scope?: vscode.Uri;
}

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

  if (await isAvailable(resolvedRubyfmtPath, cwd)) {
    return true;
  }

  const selection = await vscode.window.showWarningMessage(
    `rubyfmt was not found as '${resolvedRubyfmtPath}'`,
    'Install',
    'Configure',
    "Don't ask again",
  );

  switch (selection) {
    case 'Install':
      vscode.env.openExternal(vscode.Uri.parse('https://github.com/fables-tales/rubyfmt'));
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

async function isAvailable(command: string, cwd?: string): Promise<boolean> {
  const whereOrWhich = process.platform === 'win32' ? 'where' : 'which';
  return new Promise((resolve, _reject) =>
    exec(`${whereOrWhich} ${command}`, { cwd }, (error) => resolve(!error)),
  );
}

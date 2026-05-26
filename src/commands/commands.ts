import * as vscode from 'vscode';
import { ExtensionContext } from '../extensionContext';
import { formatPendingChanges } from './formatPendingChanges';
import { verifyFormatter } from './verifyFormatter';

export function registerCommands(context: ExtensionContext): void {
  const {
    commands: { registerCommand: cr },
  } = vscode;
  context.disposables.push(
    cr('formatto.formatPendingChanges', () => formatPendingChanges(context)),
    cr('formatto.verifyFormatter', () =>
      verifyFormatter(context, undefined, undefined, { forceVerification: true }),
    ),
  );
}

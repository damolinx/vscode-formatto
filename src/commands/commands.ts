import * as vscode from 'vscode';
import { ExtensionContext } from '../extensionContext';
import { formatPendingChanges } from './formatPendingChanges';

export function registerCommands(context: ExtensionContext): void {
  const {
    commands: { registerCommand: cr },
  } = vscode;
  context.disposables.push(
    cr('formatto.formatPendingChanges', () => formatPendingChanges(context)),
  );
}

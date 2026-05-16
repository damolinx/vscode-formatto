import * as vscode from 'vscode';
import { registerCommands } from './commands/commands';
import { ExtensionContext } from './extensionContext';
import { registerDocumentFormattingEditProvider } from './providers/documentFormattingProvider';
import { registerRangeFormattingEditProvider } from './providers/rangeFormattingEditProvider';

export function activate(extensionContext: vscode.ExtensionContext) {
  const context = new ExtensionContext(extensionContext);
  context.log.info('Activating extension', extensionContext.extension.packageJSON.version);

  registerCommands(context);
  registerDocumentFormattingEditProvider(context);
  registerRangeFormattingEditProvider(context);
}

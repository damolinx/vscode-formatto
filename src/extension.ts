import * as vscode from 'vscode';
import { formatPendingChanges } from './commands/formatPendingChanges';
import { ExtensionContext } from './extensionContext';
import { registerDocumentFormattingEditProvider } from './providers/documentFormattingProvider';
import { registerRangeFormattingEditProvider } from './providers/rangeFormattingEditProvider';

export function activate(extensionContext: vscode.ExtensionContext) {
  const context = new ExtensionContext(extensionContext);
  context.log.info('Activating extension', extensionContext.extension.packageJSON.version);

  const {
    commands: { registerCommand: cr },
  } = vscode;
  context.disposables.push(
    cr('formatto.formatPendingChanges', () => formatPendingChanges(context)),
  );

  registerDocumentFormattingEditProvider(context);

  if (context.configuration.enableRangeFormatting) {
    context.log.info('Format-Selection enabled. Setting: `formatto.enableRangeFormatting`');
    registerRangeFormattingEditProvider(context);
  } else {
    context.log.info('Format-Selection not enabled. Setting: `formatto.enableRangeFormatting`');
  }
}

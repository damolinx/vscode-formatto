import * as vscode from 'vscode';
import { ExtensionContext } from './extensionContext';
import { registerDocumentFormattingEditProvider } from './providers/documentFormattingProvider';
import { registerRangeFormattingEditProvider } from './providers/rangeFormattingEditProvider';

export function activate(extensionContext: vscode.ExtensionContext) {
  const context = new ExtensionContext(extensionContext);
  context.log.info('Activating extension', extensionContext.extension.packageJSON.version);

  registerDocumentFormattingEditProvider(context);

  if (context.configuration.enableRangeFormatting) {
    context.log.info('RangeFormattingEdit enabled');
    registerRangeFormattingEditProvider(context);
  } else {
    context.log.info('RangeFormattingEdit not enabled');
  }
}

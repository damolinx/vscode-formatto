import * as vscode from 'vscode';
import { Configuration } from './configuration';
import { FormatterProvider } from './formatters/formatterProvider';

export class ExtensionContext {
  public readonly configuration: Configuration;
  public readonly formatters: FormatterProvider;
  public readonly log: vscode.LogOutputChannel;

  constructor(public readonly extensionContext: vscode.ExtensionContext) {
    this.configuration = new Configuration();
    this.log = vscode.window.createOutputChannel('Formatto', { log: true });

    this.formatters = new FormatterProvider(this);
    this.disposables.push(this.log);
  }

  public get disposables(): vscode.Disposable[] {
    return this.extensionContext.subscriptions;
  }
}

import * as vscode from 'vscode';
import { Configuration } from './configuration';

export class ExtensionContext {
  public readonly extensionContext: vscode.ExtensionContext;
  public readonly log: vscode.LogOutputChannel;
  public readonly configuration: Configuration;

  constructor(context: vscode.ExtensionContext) {
    this.configuration = new Configuration();
    this.extensionContext = context;
    this.log = vscode.window.createOutputChannel('Formatto', { log: true });
    this.disposables.push(this.log);
  }

  public get disposables(): vscode.Disposable[] {
    return this.extensionContext.subscriptions;
  }
}

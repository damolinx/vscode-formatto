import * as vscode from 'vscode';
import { ExtensionContext } from '../extensionContext';
import { Formatter } from './formatter';
import { RubyfmtFormatter } from './rubyfmt';
import { RufoFormatter } from './rufo';
import { StandardRbFormatter } from './standardrb';
import { FormatterName } from './types';

export class FormatterProvider {
  private readonly cachedFormatters: Map<FormatterName, Formatter>;

  constructor(private readonly context: ExtensionContext) {
    this.cachedFormatters = new Map();
  }

  private createFormatter(name: FormatterName): Formatter {
    switch (name) {
      case 'rubyfmt':
        return new RubyfmtFormatter(this.context);
      case 'rufo':
        return new RufoFormatter(this.context);
      case 'standardrb':
        return new StandardRbFormatter(this.context);
      default:
        throw new Error(`Unknown formatter: ${name satisfies never}`);
    }
  }

  public get(name: FormatterName): Formatter {
    let instance = this.cachedFormatters.get(name);
    if (!instance) {
      instance = this.createFormatter(name);
      this.cachedFormatters.set(name, instance);
    }
    return instance;
  }

  public getFor(uri: vscode.Uri): Formatter {
    const name = this.context.configuration.getFormatterName(uri);
    return this.get(name);
  }
}

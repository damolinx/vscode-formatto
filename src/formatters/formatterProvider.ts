import * as vscode from 'vscode';
import { ExtensionContext } from '../extensionContext';
import { Formatter } from './formatter';
import { FormatterName } from './formatterName';
import { RubyfmtFormatter } from './rubyfmt';
import { RufoFormatter } from './rufo';
import { StandardRbFormatter } from './standardrb';

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
    let formatter = this.cachedFormatters.get(name);
    if (!formatter) {
      this.context.log.debug(`FormatterProvider: Create formatter '${name}'`);
      formatter = this.createFormatter(name);
      this.cachedFormatters.set(name, formatter);
    }
    return formatter;
  }

  public getFor(scope?: vscode.ConfigurationScope): Formatter {
    const name = this.context.configuration.getFormatterName(scope);
    return this.get(name);
  }
}

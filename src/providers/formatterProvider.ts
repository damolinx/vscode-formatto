import * as vscode from 'vscode';
import { ExtensionContext } from '../extensionContext';
import { Formatter } from '../formatters/formatter';
import { FormatterId } from '../formatters/formatterId';
import { validateFormatter } from '../formatters/formatterValidation';
import { RubyfmtFormatter } from '../formatters/rubyfmt/rubyfmt';
import { RubyfmtFormatterSpec } from '../formatters/rubyfmt/rubyfmtSpec';
import { RufoFormatter } from '../formatters/rufo/rufo';
import { RufoFormatterSpec } from '../formatters/rufo/rufoSpec';
import { StandardRbFormatter } from '../formatters/standardrb/standardrb';
import { StandardRbFormatterSpec } from '../formatters/standardrb/standardrbSpec';

export class FormatterProvider implements vscode.Disposable {
  private readonly cachedFormatters: Map<FormatterId, Formatter>;
  private supportedLanguages?: string[];

  constructor(private readonly context: ExtensionContext) {
    this.cachedFormatters = new Map();
  }

  dispose() {
    vscode.Disposable.from(...this.cachedFormatters.values()).dispose();
  }

  private createFormatter(name: FormatterId): Formatter {
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

  public get(name: FormatterId): Formatter {
    let formatter = this.cachedFormatters.get(name);
    if (!formatter) {
      this.context.log.debug(`FormatterProvider: Create formatter '${name}'`);
      formatter = this.createFormatter(name);
      this.cachedFormatters.set(name, formatter);
    }
    return formatter;
  }

  public getFor(scope?: vscode.ConfigurationScope): Formatter {
    const name = this.context.configuration.getFormatterId(scope);
    return this.get(name);
  }

  public getSupportedLanguages(): string[] {
    this.supportedLanguages ??= Array.from(
      new Set(
        [RubyfmtFormatterSpec, RufoFormatterSpec, StandardRbFormatterSpec].flatMap(
          (spec) => spec.supportedLanguages,
        ),
      ),
    );
    return this.supportedLanguages;
  }

  public resolveFor(
    uri: vscode.Uri,
  ): { formatter: Formatter; reason?: never } | { formatter?: never; reason: string } {
    const formatter = this.getFor(uri);
    const reason = validateFormatter(this.context, formatter, uri);
    if (reason) {
      return { reason };
    }

    return { formatter };
  }
}

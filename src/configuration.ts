import * as vscode from 'vscode';
import { EXTENSION_PREFIX } from './constants';
import { capitalizeFormatterName, FormatterName } from './formatters/types';
import { resolveTokenizedPath } from './utils/pathTokenization';

export class Configuration {
  /**
   * Get a {@link EXTENSION_PREFIX `formatto`} configuration object scoped by {@link scope}.
   */
  private getConfiguration(scope?: vscode.ConfigurationScope): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(EXTENSION_PREFIX, scope);
  }

  /**
   * Get a {@link getConfiguration configuration} value from a specific {@link scope}.
   * @param section — Configuration name, supports dotted names.
   * @param defaultValue — Value returned if the setting is not defined.
   */
  public getValue<T>(scope: vscode.ConfigurationScope | undefined, section: string): T | undefined;
  public getValue<T>(
    scope: vscode.ConfigurationScope | undefined,
    section: string,
    defaultValue: T,
  ): T;
  public getValue<T>(
    scope: vscode.ConfigurationScope | undefined,
    section: string,
    defaultValue?: T,
  ): T | undefined {
    return this.getConfiguration(scope).get(section, defaultValue);
  }

  /**
   * Get a {@link getConfiguration configuration} value, applying VS Code's
   * normal precedence rules.
   * @param section — Configuration name, supports dotted names.
   * @param defaultValue — Value returned if the setting is not defined.
   */
  private resolveValue<T>(section: string): T | undefined;
  private resolveValue<T>(section: string, defaultValue: T): T;
  private resolveValue<T>(section: string, defaultValue?: T): T | undefined {
    return this.getConfiguration().get(section, defaultValue);
  }

  /**
   * Enable {@link vscode.DocumentRangeFormattingEditProvider} provider.
   */
  public get enableRangeFormatting(): boolean {
    return this.resolveValue('enableRangeFormatting', false);
  }

  /**
   * Get the configuration key for a formatter's executable path.
   * @param withPrefix Whether to include the extension prefix.
   */
  public formatterPathKey(formatter: FormatterName, withPrefix = false): string {
    const key = `${formatter}Path`;
    return withPrefix ? `${EXTENSION_PREFIX}.${key}` : key;
  }

  /**
   * Get {@link getFormatterName configured formatter} additional arguments.
   */
  public getFormatterAdditionalArgs(
    formatter: FormatterName,
    scope?: vscode.ConfigurationScope,
  ): string[] {
    return this.getValue<string[]>(scope, `${formatter}Args`, []);
  }

  /**
   * Get the configured formatter name.
   */
  public getFormatterName(
    scope: vscode.ConfigurationScope | undefined,
    defaultValue: FormatterName = 'rubyfmt',
  ): FormatterName {
    return this.getValue<FormatterName>(scope, 'formatter', defaultValue);
  }

  /**
   * Get {@link getFormatterName configured formatter} path.
   */
  public getFormatterPath(
    formatter: FormatterName,
    scope?: vscode.ConfigurationScope,
    resolveTokens = true,
  ): string {
    const rawValue = this.getValue(scope, this.formatterPathKey(formatter), formatter);
    if (!resolveTokens) {
      return rawValue;
    }

    const contextUri = !scope || scope instanceof vscode.Uri ? scope : scope.uri;
    return resolveTokenizedPath(rawValue, contextUri);
  }

  /**
   * Whether Format Pending Changes should include staged changes.
   */
  public getFormatPendingChangesIncludeStaged(scope?: vscode.ConfigurationScope): boolean {
    return this.getValue(scope, 'formatPendingChanges.includeStaged', true);
  }

  /**
   * Whether to run with `bundle exec`.
   */
  public getPreferBundler(formatter: FormatterName, scope?: vscode.ConfigurationScope): boolean {
    return this.getValue(scope, this.preferBundlerKey(formatter), false);
  }

  /**
   * Get the configuration key to `preferBundler` setting.
   * @param withPrefix Whether to include the extension prefix.
   */
  public preferBundlerKey(formatter: FormatterName, withPrefix = false): string {
    const key = `${formatter}PreferBundler`;
    return withPrefix ? `${EXTENSION_PREFIX}.${key}` : key;
  }

  /**
   * Whether formatter should verify that resolved {@link getFormatterPath path}
   * is reachable.
   */
  public shouldVerifyFormatter(formatter: FormatterName): boolean {
    return this.resolveValue(this.verifyFormatterKey(formatter), true);
  }

  /**
   * Update {@link shouldVerifyFormatter} setting. Defaults to
   * {@link vscode.ConfigurationTarget.Global user settings}.
   */
  public async updateVerifyFormatter(
    formatter: FormatterName,
    value: boolean,
    configurationTarget = vscode.ConfigurationTarget.Global,
  ): Promise<void> {
    await this.getConfiguration().update(
      this.verifyFormatterKey(formatter),
      value,
      configurationTarget,
    );
  }

  /**
   * Get the configuration key to toggle formatter's verification.
   * @param withPrefix Whether to include the extension prefix.
   */
  public verifyFormatterKey(formatter: FormatterName, withPrefix = false): string {
    const key = `verify${capitalizeFormatterName(formatter)}`;
    return withPrefix ? `${EXTENSION_PREFIX}.${key}` : key;
  }
}

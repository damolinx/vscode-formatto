import * as vscode from 'vscode';
import { EXTENSION_PREFIX, MAX_CONCURRENCY } from './constants';
import { FormatterId } from './formatters/formatterId';
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
   * @param section Configuration name, supports dotted names.
   * @param defaultValue Value returned if the setting is not defined.
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
   * @param section Configuration name, supports dotted names.
   * @param defaultValue Value returned if the setting is not defined.
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
  public formatterPathKey(formatter: FormatterId, withPrefix = false): string {
    const key = `${formatter}Path`;
    return withPrefix ? `${EXTENSION_PREFIX}.${key}` : key;
  }

  /**
   * Additional file extensions to accept for formatting.
   */
  public getAdditionalSupportedExtensions(scope?: vscode.ConfigurationScope): string[] {
    return this.getValue<string[]>(scope, 'additionalSupportedExtensions', []);
  }

  /**
   * Glob patterns for files that should not be formatted.
   */
  public getExcludePatterns(scope?: vscode.ConfigurationScope): string[] {
    return this.getValue<string[]>(scope, 'excludePatterns', []);
  }

  /**
   * Get {@link getFormatterId configured formatter} additional arguments.
   */
  public getFormatterAdditionalArgs(
    formatter: FormatterId,
    scope?: vscode.ConfigurationScope,
  ): string[] {
    return this.getValue<string[]>(scope, `${formatter}Args`, []);
  }

  /**
   * Get the configured formatter ID.
   */
  public getFormatterId(
    scope: vscode.ConfigurationScope | undefined,
    defaultValue: FormatterId = 'rubyfmt',
  ): FormatterId {
    return this.getValue<FormatterId>(scope, 'formatter', defaultValue);
  }

  /**
   * Get {@link getFormatterId configured formatter} path.
   */
  public getFormatterPath(
    formatter: FormatterId,
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
   * Whether Format Pending Changes should automatically save files after formatting.
   */
  public getFormatPendingChangesAutoSave(scope?: vscode.ConfigurationScope): boolean {
    return this.getValue(scope, 'formatPendingChanges.autoSave', true);
  }

  /**
   * Maximum concurrency level. Defaults to {@link MAX_CONCURRENCY}.
   */
  public getMaxConcurrency(formatter: FormatterId, scope?: vscode.ConfigurationScope): number {
    return this.getValue(scope, `${formatter}MaxConcurrency`, MAX_CONCURRENCY);
  }

  /**
   * Whether to run with `bundle exec`.
   */
  public getPreferBundler(formatter: FormatterId, scope?: vscode.ConfigurationScope): boolean {
    return this.getValue(scope, this.preferBundlerKey(formatter), false);
  }

  /**
   * Get the configuration key to `preferBundler` setting.
   * @param withPrefix Whether to include the extension prefix.
   */
  public preferBundlerKey(formatter: FormatterId, withPrefix = false): string {
    const key = `${formatter}PreferBundler`;
    return withPrefix ? `${EXTENSION_PREFIX}.${key}` : key;
  }

  /**
   * Whether formatter should verify that resolved {@link getFormatterPath path}
   * is reachable.
   */
  public shouldVerifyFormatter(formatter: FormatterId): boolean {
    return this.resolveValue(this.verifyFormatterKey(formatter), true);
  }

  /**
   * Update {@link shouldVerifyFormatter} setting. Defaults to
   * {@link vscode.ConfigurationTarget.Global user settings}.
   */
  public async updateVerifyFormatter(
    formatter: FormatterId,
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
  public verifyFormatterKey(formatter: FormatterId, withPrefix = false): string {
    const key = `verify${formatter.charAt(0).toUpperCase() + formatter.slice(1)}`;
    return withPrefix ? `${EXTENSION_PREFIX}.${key}` : key;
  }
}

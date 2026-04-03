import * as vscode from 'vscode';
import { EXTENSION_PREFIX } from './constants';
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
  private getValue<T>(scope: vscode.ConfigurationScope | undefined, section: string): T | undefined;
  private getValue<T>(
    scope: vscode.ConfigurationScope | undefined,
    section: string,
    defaultValue: T,
  ): T;
  private getValue<T>(
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
   * Get `rubyfmt` arguments.
   */
  public getRubyfmtArgs(scope?: vscode.ConfigurationScope): string[] {
    return this.getValue<string[]>(scope, 'rubyfmtArgs', []);
  }

  /**
   * Get `rubyfmt` path.
   */
  public getRubyfmtPath(scope?: vscode.Uri, resolveTokens = true): string {
    const rawValue = this.getValue(scope, 'rubyfmtPath', 'rubyfmt');
    return resolveTokens ? resolveTokenizedPath(rawValue, scope) : rawValue;
  }

  /**
   * Verify that resolved {@link getRubyfmtPath rubyfmt path} is reachable.
   */
  public get verifyRubyfmt(): boolean {
    return this.resolveValue('verifyRubyfmt', true);
  }

  /**
   * Update {@link verifyRubyfmt} setting. Defaults to
   * {@link vscode.ConfigurationTarget.Global user settings}.
   */
  public async updateVerifyRubyfmt(
    value: boolean,
    configurationTarget = vscode.ConfigurationTarget.Global,
  ): Promise<void> {
    await this.getConfiguration().update('verifyRubyfmt', value, configurationTarget);
  }
}

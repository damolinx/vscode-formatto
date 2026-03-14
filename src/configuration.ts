import * as vscode from 'vscode';
import { EXTENSION_PREFIX } from './constants';
import { resolveTokenizedPath } from './pathTokenization';

export class Configuration {
  /**
   * Get a {@link EXTENSION_PREFIX `formatto`} configuration object scoped by {@link scope}.
   */
  private getConfiguration(scope?: vscode.Uri): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(EXTENSION_PREFIX, scope);
  }

  /**
   * Return an unscoped value from {@link EXTENSION_PREFIX} configuration.
   */
  private getGlobal<T>(section: string): T | undefined;
  private getGlobal<T>(section: string, defaultValue: T): T;
  private getGlobal<T>(section: string, defaultValue?: T): T | undefined {
    return this.getConfiguration(undefined).get(section, defaultValue);
  }

  /**
   * Return a {@link scope}-scoped value from {@link EXTENSION_PREFIX} configuration.
   */
  private getValue<T>(scope: vscode.Uri | undefined, section: string): T | undefined;
  private getValue<T>(scope: vscode.Uri | undefined, section: string, defaultValue: T): T;
  private getValue<T>(
    scope: vscode.Uri | undefined,
    section: string,
    defaultValue?: T,
  ): T | undefined {
    return this.getConfiguration(scope).get(section, defaultValue);
  }

  /**
   * Enable {@link vscode.DocumentRangeFormattingEditProvider} provider.
   */
  public get enableRangeFormatting(): boolean {
    return this.getGlobal('enableRangeFormatting', false);
  }

  /**
   * Get `rubyfmt` arguments.
   */
  public getRubyfmtArgs(scope?: vscode.Uri): string[] {
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
    return this.getGlobal('verifyRubyfmt', true);
  }

  /**
   * Update {@link verifyRubyfmt} setting.
   */
  public async updateVerifyRubyfmt(value: boolean): Promise<void> {
    await this.getConfiguration(undefined).update('verifyRubyfmt', value);
  }
}

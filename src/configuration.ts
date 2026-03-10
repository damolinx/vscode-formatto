import * as vscode from 'vscode';
import { EXTENSION_PREFIX } from './constants';

export class Configuration {
  /**
   * Get a {@link EXTENSION_PREFIX `formatto`}-scoped workspace configuration object.
   */
  protected get configuration(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(EXTENSION_PREFIX);
  }

  /**
   * Get `rubyfmt` path.
   */
  public getRubyFmtPath(): string {
    return this.configuration.get('rubyfmtPath', 'rubyfmt');
  }

  /**
   * Return a value from {@link EXTENSION_PREFIX} configuration.
   */
  public getValue<T>(section: string): T | undefined;
  public getValue<T>(section: string, defaultValue: T): T;
  public getValue<T>(section: string, defaultValue?: T): T | undefined {
    return this.configuration.get(section, defaultValue);
  }
}

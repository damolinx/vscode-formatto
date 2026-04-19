import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { ExtensionContext } from '../extensionContext';
import { FormatterDescriptor, FormatterName } from './types';

export interface FormatterOptions {
  /** Command arguments. {@link getFormatterArgs} are always appended to these. */
  args?: string[];
  /** Command. If omitted, {@link getFormatterCommand} is used. */
  cmd?: string;
  /** Command working dir. If omitted, the workspace or parent dir of the scope URI is used. */
  cwd?: string;
}

export abstract class Formatter {
  constructor(
    protected readonly context: ExtensionContext,
    public readonly descriptor: FormatterDescriptor,
  ) {}

  abstract formatText(
    document: vscode.TextDocument,
    text: string,
    isRange?: boolean,
    token?: vscode.CancellationToken,
  ): Promise<string | undefined>;

  protected getCwd(uri: vscode.Uri): string {
    const cwd = vscode.workspace.getWorkspaceFolder(uri)?.uri ?? vscode.Uri.joinPath(uri, '..');
    return cwd.fsPath;
  }

  public getFormatterCommand(scope?: vscode.Uri): string {
    return this.context.configuration.getFormatterPath(this.id, scope);
  }

  public getFormatterArgs(scope?: vscode.Uri): string[] {
    return this.context.configuration.getFormatterArgs(this.id, scope);
  }

  public get id(): FormatterName {
    return this.descriptor.id;
  }

  protected isSuccessCode(code: number | null): boolean {
    return code === 0;
  }

  protected async run(
    text: string,
    uri: vscode.Uri,
    options: FormatterOptions,
    token?: vscode.CancellationToken,
  ): Promise<string> {
    const { args = [], cwd = this.getCwd(uri) } = options;
    let cmd = options.cmd ?? this.getFormatterCommand(uri);

    const useBundler = this.context.configuration.getPreferBundler(this.id, uri);
    if (useBundler) {
      args.unshift('exec', cmd);
      cmd = 'bundle';
    }
    const mergedArgs = [...args, ...this.getFormatterArgs(uri)];

    this.context.log.info(`Running: '${cmd} ${mergedArgs.join(' ')}'${cwd ? ` Cwd: ${cwd}` : ''}`);
    return new Promise<string>((resolve, reject) => {
      const child = spawn(cmd, mergedArgs, { cwd, shell: false, stdio: 'pipe', timeout: 5000 });
      const cancelSubscription = token?.onCancellationRequested(() => {
        child.kill('SIGKILL');
        reject(new Error('Formatting canceled'));
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => (stdout += chunk.toString()));
      child.stderr.on('data', (chunk) => (stderr += chunk.toString()));
      child.on('error', (error) => reject(new Error(error.message, { cause: error })));

      child.on('close', (code) => {
        cancelSubscription?.dispose();
        if (token?.isCancellationRequested) {
          return;
        }

        if (this.isSuccessCode(code) && isBundlerSuccess(stderr)) {
          resolve(stdout);
        } else {
          const message = child.killed
            ? `${cmd} was killed. This can happen if allowed runtime was exceeded.`
            : `${cmd} exited${code !== null ? ` with code ${code}` : ''}: ${stderr.trim()}`;
          reject(new Error(message));
        }
      });

      child.stdin.end(text);
    });

    function isBundlerSuccess(stderr: string) {
      return !useBundler || stderr.length === 0;
    }
  }

  public async tryFormatDocument(
    document: vscode.TextDocument,
    token?: vscode.CancellationToken,
  ): Promise<string | undefined> {
    const path = vscode.workspace.asRelativePath(document.uri);
    this.context.log.info(`${this.id}: Format document. Path: '${path}'`);

    let formattedText: string | undefined;
    try {
      formattedText = await this.formatText(document, document.getText(), false, token);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : (error?.toString() ?? 'no error message');
      this.context.log.error(`${this.id}: Failed to format. Error: ${message}`);
    }
    return formattedText;
  }

  public async tryFormatText(
    document: vscode.TextDocument,
    range: vscode.Range,
    token?: vscode.CancellationToken,
  ): Promise<string | undefined> {
    const path = vscode.workspace.asRelativePath(document.uri);
    const rangeStr = `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
    this.context.log.info(`${this.id}: Format selection. Path: '${path}' Range: ${rangeStr}`);

    let formattedText: string | undefined;
    try {
      formattedText = await this.formatText(document, document.getText(range), true, token);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : (error?.toString() ?? 'no error message');
      this.context.log.error(`${this.id}: Failed to format. Error: ${message}`);
    }
    return formattedText;
  }
}

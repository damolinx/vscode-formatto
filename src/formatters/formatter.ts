import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { ExtensionContext } from '../extensionContext';
import { FormatterName } from './formatterName';
import { FormatterOptions } from './formatterOptions';
import { FormatterSpec } from './formatterSpec';

export abstract class Formatter {
  constructor(
    protected readonly context: ExtensionContext,
    public readonly spec: FormatterSpec,
  ) {}

  abstract formatText(
    document: vscode.TextDocument,
    text: string,
    isRange?: boolean,
    token?: vscode.CancellationToken,
  ): Promise<string | undefined>;

  public getCwd(uri: vscode.Uri): string {
    const cwd = vscode.workspace.getWorkspaceFolder(uri)?.uri ?? vscode.Uri.joinPath(uri, '..');
    return cwd.fsPath;
  }

  public getFormatterCommand(scope?: vscode.ConfigurationScope): string[] {
    const cmd = this.context.configuration.getFormatterPath(this.name, scope);
    return this.context.configuration.getPreferBundler(this.name, scope)
      ? ['bundle', 'exec', cmd]
      : [cmd];
  }

  protected isSuccessCode(code: number | null): boolean {
    return code === 0;
  }

  public get name(): FormatterName {
    return this.spec.name;
  }

  public resolveRunCommand(
    uri: vscode.Uri,
    options: FormatterOptions,
  ): { args: string[]; cmd: string; cwd: string } {
    const expandedCmd = this.getFormatterCommand(uri);
    const cmd = expandedCmd[0];
    const args = [
      ...expandedCmd.slice(1),
      ...(options.args ?? []),
      ...this.context.configuration.getFormatterAdditionalArgs(this.name, uri),
    ];

    return { args, cmd, cwd: options.cwd ?? this.getCwd(uri) };
  }

  protected async run(
    text: string,
    uri: vscode.Uri,
    options: FormatterOptions,
    token?: vscode.CancellationToken,
  ): Promise<string> {
    const { args, cmd, cwd } = this.resolveRunCommand(uri, options);
    const start = Date.now();
    return new Promise<string>((resolve, reject) => {
      const child = spawn(cmd, args, {
        cwd,
        env: options.env,
        shell: false,
        stdio: 'pipe',
        timeout: 5000,
      });
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

        this.context.log.info(
          `> ${cmd} ${args.join(' ')} [${Date.now() - start}ms]${cwd ? ` Cwd: ${cwd}` : ''}`,
        );
        if (this.isSuccessCode(code) && isBundlerCleanRun(cmd, stderr)) {
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

    function isBundlerCleanRun(cmd: string, stderr: string) {
      return cmd !== 'bundle' || stderr.length === 0;
    }
  }

  public tryFormatDocument(
    document: vscode.TextDocument,
    token?: vscode.CancellationToken,
  ): Promise<string | undefined> {
    return this.tryFormatDocumentText(document, document.getText(), token);
  }

  public async tryFormatDocumentText(
    document: vscode.TextDocument,
    documentText: string,
    token?: vscode.CancellationToken,
  ): Promise<string | undefined> {
    const path = vscode.workspace.asRelativePath(document.uri);
    this.context.log.info(`${this.name}: Format document. Path: '${path}'`);

    let formattedText: string | undefined;
    try {
      formattedText = await this.formatText(document, documentText, false, token);
      if (
        formattedText !== undefined &&
        this.spec.injectsTrailingNewline &&
        document.uri.scheme === 'vscode-notebook-cell'
      ) {
        formattedText = formattedText.trimEnd();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : (error?.toString() ?? 'no error message');
      this.context.log.error(`${this.name}: Failed to format. Error: ${message}`);
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
    this.context.log.info(`${this.name}: Format selection. Path: '${path}' Range: ${rangeStr}`);

    let formattedText: string | undefined;
    try {
      formattedText = await this.formatText(document, document.getText(range), true, token);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : (error?.toString() ?? 'no error message');
      this.context.log.error(`${this.name}: Failed to format. Error: ${message}`);
    }
    return formattedText;
  }
}

import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { extname } from 'path';
import { minimatch } from 'minimatch';
import { ExtensionContext } from '../extensionContext';
import { FormatContext } from './formatContext';
import { FormatterName } from './formatterName';
import { FormatterOptions } from './formatterOptions';
import { FormatterSpec } from './formatterSpec';

export abstract class Formatter {
  constructor(
    protected readonly context: ExtensionContext,
    public readonly spec: FormatterSpec,
  ) {}

  protected abstract formatText(
    text: string,
    context: FormatContext,
    token?: vscode.CancellationToken,
  ): Promise<string | undefined>;

  public getCwd(uri: vscode.Uri): string {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    return (folder?.uri ?? vscode.Uri.joinPath(uri, '..')).fsPath;
  }

  public getFormatterCommand(scope?: vscode.ConfigurationScope): string[] {
    const cmd = this.context.configuration.getFormatterPath(this.name, scope);
    return this.context.configuration.getPreferBundler(this.name, scope)
      ? ['bundle', 'exec', cmd]
      : [cmd];
  }

  protected isBundlerCleanRun(cmd: string, stderr: string) {
    return cmd !== 'bundle' || stderr.trim() === '';
  }

  public isExcluded(uri: vscode.Uri): boolean {
    const patterns = this.context.configuration.getExcludePatterns(uri) ?? [];
    if (patterns.at.length === 0) {
      return false;
    }

    const fsPath = uri.fsPath;
    return patterns.some((pattern) => minimatch(fsPath, pattern, { dot: true }));
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
    const expandedCmd = options.cmd ? [options.cmd] : this.getFormatterCommand(uri);
    const [cmd, ...prefixArgs] = expandedCmd;
    const args = [
      ...prefixArgs,
      ...(options.args ?? []),
      ...this.context.configuration.getFormatterAdditionalArgs(this.name, uri),
    ];

    return { args, cmd, cwd: options.cwd ?? this.getCwd(uri) };
  }

  protected async run(
    text: string,
    formatContext: FormatContext,
    options: FormatterOptions,
    token?: vscode.CancellationToken,
  ): Promise<string | undefined> {
    const reason = this.validateSupported(formatContext.uri, formatContext.languageId);
    if (reason) {
      this.context.log.info(`${this.name}: ${reason}`);
      return;
    }

    const { args, cmd, cwd } = this.resolveRunCommand(formatContext.uri, options);
    const start = Date.now();
    return new Promise<string | undefined>((resolve, reject) => {
      const child = spawn(cmd, args, {
        cwd,
        env: options.env,
        shell: false,
        stdio: 'pipe',
        timeout: this.spec.timeouts?.executionMs ?? 5000,
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
          `> ${cmd} ${args.join(' ')} (${Date.now() - start}ms)${cwd ? ` Cwd: ${cwd}` : ''}`,
        );
        if (this.isSuccessCode(code) && this.isBundlerCleanRun(cmd, stderr)) {
          resolve(stdout !== text ? stdout : undefined);
        } else {
          const message = child.killed
            ? `${cmd} was killed. This can happen if allowed runtime was exceeded.`
            : `${cmd} exited${code !== null ? ` with code ${code}` : ''}: ${stderr.trim()}`;
          reject(new Error(message));
        }
      });

      child.stdin.end(this.spec.inputKind === 'stdin' ? text : undefined);
    });
  }

  public async tryFormatDocument(
    document: vscode.TextDocument,
    token?: vscode.CancellationToken,
  ): Promise<string | undefined> {
    const path = vscode.workspace.asRelativePath(document.uri);
    if (this.isExcluded(document.uri)) {
      this.context.log.info(
        `${this.name}: Skipped document (excluded by pattern). Path: '${path}'`,
      );
      return;
    }

    this.context.log.info(`${this.name}: Format document. Path: '${path}'`);
    let formattedText: string | undefined;
    try {
      formattedText = await this.formatText(
        document.getText(),
        {
          isDirty: document.isDirty,
          isRange: false,
          languageId: document.languageId,
          uri: document.uri,
        },
        token,
      );
      if (
        formattedText !== undefined &&
        this.spec.appendsTrailingNewline &&
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
    if (this.isExcluded(document.uri)) {
      this.context.log.info(`${this.name}: Skipped (excluded by pattern)`);
      return;
    }

    const path = vscode.workspace.asRelativePath(document.uri);
    const rangeStr = `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
    this.context.log.info(`${this.name}: Format selection. Path: '${path}' Range: ${rangeStr}`);

    let formattedText: string | undefined;
    try {
      formattedText = await this.formatText(
        document.getText(range),
        {
          isDirty: document.isDirty,
          isRange: true,
          languageId: document.languageId,
          uri: document.uri,
        },
        token,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : (error?.toString() ?? 'no error message');
      this.context.log.error(`${this.name}: Failed to format. Error: ${message}`);
    }
    return formattedText;
  }

  protected validateSupported(uri: vscode.Uri, languageId: string): string | undefined {
    const extension = extname(uri.fsPath).toLowerCase();
    if (!extension) {
      return;
    }

    const additional = this.context.configuration
      .getAdditionalSupportedExtensions(uri)
      .map((ext) => ext.toLowerCase());
    const supported = new Set([...this.spec.supportedExtensions, ...additional]);
    return supported.has(extension)
      ? undefined
      : `Unsupported extension '${extension}' (${languageId})`;
  }
}

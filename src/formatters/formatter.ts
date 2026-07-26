import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { extname } from 'path';
import { ExtensionContext } from '../extensionContext';
import { FormatterSpec } from './formatterSpec';

export interface FormatterCommand {
  cmd: string;
  args: string[];
  cwd?: string;
}

export interface RunParams {
  text: string;
  range?: vscode.Range;
  scopeUri?: vscode.ConfigurationScope;
  uri: vscode.Uri;
}

export abstract class Formatter implements vscode.Disposable {
  protected disposables: vscode.Disposable[];

  protected constructor(
    public readonly context: ExtensionContext,
    public readonly spec: FormatterSpec,
  ) {
    this.disposables = [];
  }

  dispose() {
    vscode.Disposable.from(...this.disposables).dispose();
  }

  protected buildCommand(
    scope?: vscode.ConfigurationScope,
    additionalArgs: string[] = [],
  ): FormatterCommand {
    const cmd = this.context.configuration.getFormatterPath(this.spec.id, scope);
    const scopeUri = scope && (scope instanceof vscode.Uri ? scope : scope.uri);
    const cwd = scopeUri && vscode.workspace.getWorkspaceFolder(scopeUri)?.uri.fsPath;

    return this.spec.supportsBundler &&
      this.context.configuration.getPreferBundler(this.spec.id, scope)
      ? { cmd: 'bundle', args: ['exec', cmd, ...additionalArgs], cwd }
      : { cmd, args: additionalArgs, cwd };
  }

  public buildFormatCommand(
    scope: vscode.ConfigurationScope,
    additionalArgs: string[] = [],
  ): FormatterCommand {
    return this.buildCommand(
      scope,
      additionalArgs.concat(
        this.context.configuration.getFormatterAdditionalArgs(this.spec.id, scope),
      ),
    );
  }

  public buildVersionCommand(scope?: vscode.ConfigurationScope): FormatterCommand {
    return this.buildCommand(scope, ['--version']);
  }

  protected abstract format(
    document: vscode.TextDocument,
    range?: vscode.Range,
    token?: vscode.CancellationToken,
  ): Promise<string | undefined>;

  public async formatDocument(
    document: vscode.TextDocument,
    range?: vscode.Range,
    token?: vscode.CancellationToken,
  ): Promise<vscode.TextEdit | undefined> {
    let formattedText = await this.format(document, range, token);
    if (formattedText === undefined) {
      return;
    }

    if (range || document.uri.scheme === 'vscode-notebook-cell') {
      formattedText = formattedText.trimEnd();
    }

    return vscode.TextEdit.replace(range ?? this.getFullDocumentRange(document), formattedText);
  }

  private getFullDocumentRange(document: vscode.TextDocument): vscode.Range {
    return new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
  }

  public async getVersion(
    cmd: string,
    cwd?: string,
    args: string[] = [],
  ): Promise<
    | { error: Error & { code: string; path: string }; version?: never }
    | { error?: never; version: string }
  > {
    return new Promise((resolve) => {
      const child = spawn(cmd, args, { cwd });

      let stdout = '';
      let stderr = '';
      let finished = false;

      const killTimer = setTimeout(() => {
        if (!finished) {
          child.kill();
        }
      }, this.spec.timeouts.version);

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (error: Error) => {
        clearTimeout(killTimer);
        finished = true;
        resolve({ error: error as any });
      });

      child.on('close', (code, signal) => {
        clearTimeout(killTimer);
        finished = true;

        if (signal) {
          const error: any = new Error(
            `Command was killed: ${cmd}${args.length ? ` ${args.join(' ')}` : ''}`,
          );
          error.code = signal;
          error.path = cmd;
          resolve({ error });
        } else if (code !== 0) {
          const error: any = new Error(stderr || `Command failed with exit code ${code}`);
          error.code = code?.toString();
          error.path = cmd;
          resolve({ error });
        } else {
          resolve({ version: stdout.trim() || 'unknown' });
        }
      });
    });
  }

  protected async run(
    { text, range, scopeUri, uri }: RunParams,
    options?: {
      args?: string[];
      env?: NodeJS.ProcessEnv;
      errorStream?: 'stderr' | 'stdout';
    },
    token?: vscode.CancellationToken,
  ): Promise<string | undefined> {
    const { id } = this.spec;
    const { args, cmd, cwd } = this.buildFormatCommand(scopeUri ?? uri, options?.args);
    const startTime = Date.now();
    return new Promise<string | undefined>((resolve, reject) => {
      const child = spawn(cmd, args, {
        cwd,
        env: options?.env,
        shell: false,
        stdio: 'pipe',
        timeout: this.spec.timeouts.formatting,
      });
      const disposable = token?.onCancellationRequested(() => {
        child.kill('SIGKILL');
        reject(new Error('Formatting canceled'));
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => (stdout += chunk.toString()));
      child.stderr.on('data', (chunk) => (stderr += chunk.toString()));
      child.on('error', (error) => {
        disposable?.dispose();
        reject(new Error(error.message, { cause: error }));
      });

      child.on('close', (code) => {
        disposable?.dispose();
        if (token?.isCancellationRequested) {
          return;
        }

        const time = Date.now() - startTime;
        if (range) {
          const { start, end } = range;
          const rangeText = `${start.line}${start.character ? `:${start.character}` : ''}-${end.line}${end.character ? `:${end.character}` : ''}`;
          this.context.log.info(`${id}: Format selection (${time}ms). ${uri.fsPath}:${rangeText}`);
        } else {
          this.context.log.info(`${id}: Format document (${time}ms). ${uri.fsPath}`);
        }

        const executionInfo = `> ${cmd}${args?.length ? ` ${args.join(' ')}` : ''}${cwd ? ` Cwd: ${cwd}` : ''}`;
        if (code === 0 && (cmd !== 'bundle' || stderr.trim() === '')) {
          this.context.log.debug(executionInfo);
          resolve(stdout !== text ? stdout : undefined);
        } else {
          const normalizedError = (
            options?.errorStream === 'stdout' ? stdout.trim() || stderr : stderr
          ).trim();
          const message = child.killed
            ? `${id} was killed`
            : `${id} exited${code !== null ? `(${code})` : ''}\n${executionInfo}\n${normalizedError}`;
          const error: any = new Error(message);
          error.code = code;
          reject(error);
        }
      });

      child.stdin.end(text);
    });
  }

  public supportsDocument(
    document: vscode.TextDocument,
  ): { supported: true; reason?: never } | { reason: string; supported?: never } {
    if (document.isUntitled) {
      return this.spec.supportedLanguages.includes(document.languageId)
        ? { supported: true }
        : { reason: `Unsupported language '${document.languageId}'` };
    }
    return this.supportsUri(document.uri);
  }

  public supportsUri(
    uri: vscode.Uri,
  ): { supported: true; reason?: never } | { reason: string; supported?: never } {
    const rawExtension = extname(uri.fsPath);
    if (!rawExtension) {
      return { reason: 'Unsupported file (no extension)' };
    }

    let matches: (s: string) => boolean;
    if (process.platform === 'win32') {
      const extension = rawExtension.toLowerCase();
      matches = (s: string) => s.toLowerCase() === extension;
    } else {
      matches = (s: string) => s === rawExtension;
    }

    if (
      this.spec.supportedExtensions.some(matches) ||
      this.context.configuration.getAdditionalSupportedExtensions(uri).some(matches)
    ) {
      return { supported: true };
    }

    return { reason: `Unsupported file extension ('${rawExtension}')` };
  }
}

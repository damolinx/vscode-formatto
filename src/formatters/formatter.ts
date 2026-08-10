import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { extname } from 'path';
import { ExtensionContext } from '../extensionContext';
import { runWithConcurrencyLimit } from '../utils/async';
import { buildBatches } from '../utils/batching';
import { commandToLogString } from '../utils/shell';
import { FormatterSpec } from './formatterSpec';

export interface FormatterCommand {
  cmd: string;
  args: string[];
  cwd?: string;
}

export abstract class Formatter implements vscode.Disposable {
  protected disposables: vscode.Disposable[];

  protected constructor(
    public readonly context: ExtensionContext,
    public readonly spec: FormatterSpec,
  ) {
    this.disposables = [];
  }

  public dispose(): void {
    vscode.Disposable.from(...this.disposables).dispose();
  }

  protected buildCommand(
    scope?: vscode.ConfigurationScope,
    ...additionalArgs: string[]
  ): FormatterCommand {
    const cmd = this.context.configuration.getFormatterPath(this.spec.id, scope);
    const scopeUri = scope && (scope instanceof vscode.Uri ? scope : scope.uri);
    const cwd = scopeUri && vscode.workspace.getWorkspaceFolder(scopeUri)?.uri.fsPath;

    return this.spec.supportsBundler &&
      this.context.configuration.getPreferBundler(this.spec.id, scope)
      ? { cmd: 'bundle', args: ['exec', cmd, ...additionalArgs], cwd }
      : { cmd, args: additionalArgs, cwd };
  }

  public abstract buildFormatCommand(
    scope: vscode.ConfigurationScope | undefined,
    uris?: readonly vscode.Uri[],
    ...additionalArgs: string[]
  ): FormatterCommand;

  public buildVersionCommand(scope?: vscode.ConfigurationScope): FormatterCommand {
    return this.buildCommand(scope, '--version');
  }

  public async formatDocument(
    document: vscode.TextDocument,
    range?: vscode.Range,
    token?: vscode.CancellationToken,
  ): Promise<string | undefined> {
    let formattedText = await this.formatDocumentCore(document, range, token);
    if (formattedText === undefined) {
      return;
    }

    if (range || document.uri.scheme === 'vscode-notebook-cell') {
      formattedText = formattedText.trimEnd();
    }

    return formattedText;
  }

  protected abstract formatDocumentCore(
    document: vscode.TextDocument,
    range?: vscode.Range,
    token?: vscode.CancellationToken,
  ): Promise<string | undefined>;

  public async formatEdit(
    document: vscode.TextDocument,
    range?: vscode.Range,
    token?: vscode.CancellationToken,
  ): Promise<vscode.TextEdit | undefined> {
    const formattedText = await this.formatDocument(document, range, token);
    if (formattedText === undefined) {
      return;
    }

    const rangeToReplace =
      range ??
      new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));

    return vscode.TextEdit.replace(rangeToReplace, formattedText);
  }

  public async formatFiles(
    workspaceFolder: vscode.WorkspaceFolder | undefined,
    uris: readonly vscode.Uri[],
    token: vscode.CancellationToken,
  ): Promise<void> {
    if (uris.length === 0) {
      return;
    }

    const maxConcurrency = this.context.configuration.getMaxConcurrency(
      this.spec.id,
      workspaceFolder,
    );
    const batches = buildBatches(uris, maxConcurrency);
    const concurrency = maxConcurrency ? Math.min(maxConcurrency, batches.length) : batches.length;

    this.context.log.debug(
      `${this.spec.id}: Formatting ${uris.length} files using ` +
        `${batches.length} batches (${concurrency} concurrent).`,
    );
    await runWithConcurrencyLimit(
      batches,
      concurrency,
      (uris, batchIndex) =>
        this.execute(
          this.buildFormatCommand(workspaceFolder, uris),
          { logPrefix: `${batchIndex + 1}/${batches.length}` },
          token,
        ),
      token,
    );
  }

  protected getFormatConfiguredArgs(scope?: vscode.ConfigurationScope): string[] {
    return this.context.configuration.getFormatterAdditionalArgs(this.spec.id, scope);
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
          const error: any = new Error(`Command was killed: ${commandToLogString(cmd, args)}`);
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

  protected async execute(
    command: FormatterCommand,
    options?: {
      env?: NodeJS.ProcessEnv;
      errorStream?: 'stderr' | 'stdout';
      logPrefix?: string;
      stdinInput?: string;
    },
    token?: vscode.CancellationToken,
  ): Promise<{ stdout: string; stderr: string }> {
    const { cmd, args, cwd } = command;
    const refId = `${this.spec.id}${options?.logPrefix ? `(${options.logPrefix})` : ''}`;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
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

        this.context.log.debug(
          `${refId}: ${commandToLogString(cmd, args)} (${Date.now() - startTime}ms${cwd ? `, cwd: ${cwd}` : ''})`,
        );
        if (code === 0 && (cmd !== 'bundle' || stderr.trim() === '')) {
          resolve({ stdout, stderr });
          return;
        }

        const normalizedError = (
          options?.errorStream === 'stdout' ? stdout.trim() || stderr : stderr
        ).trim();

        const error: any = new Error(
          child.killed
            ? `${refId} was killed`
            : `${refId} exited${code !== null ? `(${code})` : ''}\n${normalizedError}`,
        );

        error.code = code;
        reject(error);
      });

      child.stdin.end(options?.stdinInput);
    });
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

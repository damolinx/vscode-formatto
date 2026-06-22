import * as vscode from 'vscode';
import { existsSync, promises as fsPromises, rmSync } from 'fs';
import { tmpdir } from 'os';
import { extname, join } from 'path';
import { ExtensionContext } from '../../extensionContext';
import { Formatter } from '../formatter';
import { StandardRbFormatterSpec } from './standardrbSpec';

export type FormattingMode = 'forceSave' | 'tmpFile';

export class StandardRbFormatter extends Formatter {
  private tmpDirPath?: string;

  constructor(context: ExtensionContext) {
    super(context, StandardRbFormatterSpec);
    this.disposables.push({
      dispose: () => {
        if (this.tmpDirPath) {
          try {
            rmSync(this.tmpDirPath, { recursive: true });
          } catch (error: any) {
            this.context.log.error(
              `${this.spec.id}: Failed to delete: ${this.tmpDirPath}`,
              error?.message ?? error,
            );
          }
        }
      },
    });
  }

  private async ensureTmpDir(): Promise<string> {
    if (!this.tmpDirPath || !existsSync(this.tmpDirPath)) {
      this.tmpDirPath = await fsPromises.mkdtemp(join(tmpdir(), 'formatto'));
    }
    return this.tmpDirPath;
  }

  protected async format(
    document: vscode.TextDocument,
    range?: vscode.Range,
    token?: vscode.CancellationToken,
  ): Promise<string | undefined> {
    const params = { text: document.getText(range), range, uri: document.uri };
    let newText: string | undefined;
    if (!range && !document.isDirty) {
      newText = await this.runStandardRb(params, false, token);
    } else {
      const mode: FormattingMode = this.getFormattingMode(Boolean(range), document.uri);
      this.context.log.debug(`${this.spec.id}: Using formatting mode: '${mode}'`);
      switch (mode) {
        case 'forceSave':
          newText = await this.formatAfterSave(params, token);
          break;
        case 'tmpFile':
          newText = await this.formatWithTemporaryFile(params, token);
          break;
        default:
          throw new Error(`Unsupported ${this.spec.id} formatting mode: ${mode}`);
      }
    }
    return newText;
  }

  private async formatAfterSave(
    params: { text: string; range?: vscode.Range; uri: vscode.Uri },
    token?: vscode.CancellationToken,
  ): Promise<string | undefined> {
    const document = await vscode.workspace.openTextDocument(params.uri);
    const saved = await document.save();
    if (!saved) {
      this.context.log.warn(
        `${this.spec.id}: Document save canceled, not formatting. ${params.uri.fsPath}`,
      );
      return;
    }

    const newText = await this.runStandardRb(params, true, token);
    return newText;
  }

  private async formatWithTemporaryFile(
    params: { text: string; range?: vscode.Range; uri: vscode.Uri },
    token?: vscode.CancellationToken,
  ): Promise<string | undefined> {
    let tmpFilePath: string | undefined;
    try {
      const tmpDirPath = await this.ensureTmpDir();
      tmpFilePath = join(
        tmpDirPath,
        `buffer-${Date.now()}-${Math.random().toString(36)}${extname(params.uri.fsPath)}`,
      );
      await fsPromises.writeFile(tmpFilePath, params.text);
      const newText = await this.runStandardRb(
        { ...params, uri: vscode.Uri.file(tmpFilePath) },
        false,
        token,
      );
      return newText;
    } finally {
      if (tmpFilePath) {
        await fsPromises.unlink(tmpFilePath).catch((reason) => {
          this.context.log.error(`${this.spec.id}: Failed to delete: ${tmpFilePath}`, reason);
        });
      }
    }
  }

  private getFormattingMode(
    formattingRange: boolean,
    scope: vscode.ConfigurationScope,
  ): FormattingMode {
    return formattingRange
      ? 'tmpFile'
      : this.context.configuration.getValue<FormattingMode>(
          scope,
          'standardrbFormattingMode',
          'tmpFile',
        );
  }

  public override getVersion(
    cmd: string,
    cwd?: string,
    args: string[] = [],
    timeout = 5000, // Longer default timeout
  ): Promise<
    | { error: Error & { code: string; path: string }; version?: never }
    | { error?: never; version: string }
  > {
    return super.getVersion(cmd, cwd, args, timeout);
  }

  private async runStandardRb(
    params: { text: string; range?: vscode.Range; uri: vscode.Uri },
    useOpenDocument: boolean,
    token: vscode.CancellationToken | undefined,
  ): Promise<string | undefined> {
    if (token?.isCancellationRequested) {
      return;
    }

    const result = await this.run(
      params,
      { args: ['--fix', params.uri.fsPath], errorSource: 'stdout' },
      token,
    ).catch((reason: Error & { code?: undefined }) => {
      if (reason.code === 1) {
        this.context.log.warn(
          `${this.spec.id}: ${reason.message?.replace(/standard:.+?\n\s+/, '')}`,
        );
        return '';
      } else {
        throw reason;
      }
    });
    if (result === undefined) {
      return;
    }

    if (useOpenDocument) {
      const document = await vscode.workspace.openTextDocument(params.uri);
      return document.getText();
    }

    return fsPromises.readFile(params.uri.fsPath, { encoding: 'utf8' });
  }
}

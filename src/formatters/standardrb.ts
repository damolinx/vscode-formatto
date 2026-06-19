import * as vscode from 'vscode';
import { existsSync, promises as fsPromises, rmSync } from 'fs';
import { tmpdir } from 'os';
import { extname, join } from 'path';
import { verifyFormatterCore } from '../commands/verifyFormatter';
import { SUPPORTED_RUBY_EXTENSIONS } from '../constants';
import { ExtensionContext } from '../extensionContext';
import { FormatContext } from './formatContext';
import { Formatter } from './formatter';
import { FormatterSpec } from './formatterSpec';

export const StandardRbDescriptor: FormatterSpec = {
  name: 'standardrb',
  appendsTrailingNewline: true,
  docs: { installation: 'https://github.com/standardrb/standard#install' },
  inputKind: 'file',
  maxConcurrency: 1,
  supportsBundler: true,
  supportedExtensions: SUPPORTED_RUBY_EXTENSIONS,
  timeouts: {
    executionMs: 5000,
    verificationMs: 5000,
  },
  versionArgs: ['--version'],
};

export type FormattingMode = 'forceSave' | 'tmpFile';

export class StandardRbFormatter extends Formatter {
  private tmpDirPath?: string;

  constructor(context: ExtensionContext) {
    super(context, StandardRbDescriptor);
    this.context.disposables.push({
      dispose: () => {
        if (this.tmpDirPath) {
          try {
            rmSync(this.tmpDirPath, { recursive: true });
          } catch (error: any) {
            this.context.log.error(
              `StandardRb: Failed to delete: ${this.tmpDirPath}`,
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

  protected override async formatText(
    text: string,
    formatContext: FormatContext,
    token?: vscode.CancellationToken,
  ): Promise<string | undefined> {
    if (!(await verifyFormatterCore(this.context, this, formatContext.uri))) {
      return;
    }

    if (!formatContext.isRange && !formatContext.isDirty) {
      return this.runStandardRb(text, formatContext, true, token);
    }

    const mode: FormattingMode = this.getFormattingMode(formatContext);
    this.context.log.debug(`StandardRb: Using formatting mode: '${mode}'`);

    switch (mode) {
      case 'forceSave':
        return await this.formatAfterSave(text, formatContext, token);
      case 'tmpFile':
        return await this.formatWithTemporaryFile(text, formatContext, token);
      default:
        throw new Error(`Unsupported StandardRB formatting mode: ${mode}`);
    }
  }

  private async formatAfterSave(
    text: string,
    formatContext: FormatContext,
    token?: vscode.CancellationToken,
  ): Promise<string | undefined> {
    const document = await vscode.workspace.openTextDocument(formatContext.uri);
    const saved = await document.save();
    if (!saved) {
      this.context.log.warn(
        'StandardRb: Document save canceled, not formatting',
        vscode.workspace.asRelativePath(formatContext.uri),
      );
      return;
    }

    return await this.runStandardRb(text, formatContext, true, token);
  }

  private async formatWithTemporaryFile(
    text: string,
    context: FormatContext,
    token?: vscode.CancellationToken,
  ): Promise<string | undefined> {
    let tmpFilePath: string | undefined;
    try {
      const tmpDirPath = await this.ensureTmpDir();
      tmpFilePath = join(
        tmpDirPath,
        `buffer-${Date.now()}-${Math.random().toString(36)}${extname(context.uri.fsPath)}`,
      );
      await fsPromises.writeFile(tmpFilePath, text);
      return await this.runStandardRb(
        text,
        {
          ...context,
          isDirty: false,
          uri: vscode.Uri.file(tmpFilePath),
        },
        false,
        token,
      );
    } finally {
      if (tmpFilePath) {
        await fsPromises.unlink(tmpFilePath).catch((reason) => {
          this.context.log.error(`StandardRb: Failed to delete: ${tmpFilePath}`, reason);
        });
      }
    }
  }

  private getFormattingMode(formatContext: FormatContext): FormattingMode {
    return formatContext.isRange
      ? 'tmpFile'
      : this.context.configuration.getValue<FormattingMode>(
          formatContext.uri,
          'standardrbFormattingMode',
          'tmpFile',
        );
  }

  protected override isSuccessCode(code: number | null): boolean {
    // 0: no changes, 1: `--fix` did not fix everything
    return code === 0 || code === 1;
  }

  private async runStandardRb(
    text: string,
    formatContext: FormatContext,
    useOpenDocument: boolean,
    token: vscode.CancellationToken | undefined,
  ): Promise<string | undefined> {
    if (token?.isCancellationRequested) {
      return;
    }

    const result = await this.run(
      text,
      formatContext,
      { args: ['--fix', formatContext.uri.fsPath] },
      token,
    );
    if (result === undefined || token?.isCancellationRequested) {
      return;
    }

    if (useOpenDocument) {
      const document = await vscode.workspace.openTextDocument(formatContext.uri);
      return document.getText();
    }

    return fsPromises.readFile(formatContext.uri.fsPath, { encoding: 'utf8' });
  }
}

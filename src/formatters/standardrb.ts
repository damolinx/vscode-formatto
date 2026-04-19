import * as vscode from 'vscode';
import { existsSync, promises as fsPromises, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { verifyFormatter } from '../commands/verifyFormatter';
import { ExtensionContext } from '../extensionContext';
import { Formatter } from './formatter';
import { FormatterDescriptor } from './types';

export const StandardRbDescriptor: FormatterDescriptor = {
  id: 'standardrb',
  injectsTrailingNewline: true,
  installUrl: 'https://github.com/standardrb/standard#install',
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

  public override async formatText(
    document: vscode.TextDocument,
    text: string,
    isRange?: boolean,
    token?: vscode.CancellationToken,
  ): Promise<string | undefined> {
    const { uri } = document;
    const options = {
      cmd: this.getFormatterCommand(uri),
      cwd: this.getCwd(uri),
    };

    if (!(await verifyFormatter(this.context, uri, options, this.descriptor))) {
      return;
    }

    if (!isRange && !document.isDirty) {
      return this.runStandardRb(uri, text, true, token);
    }

    const mode: FormattingMode = this.getFormattingMode(uri, isRange);
    this.context.log.debug(`StandardRb: Using formatting mode: '${mode}'`);

    switch (mode) {
      case 'forceSave':
        return await this.formatAfterSave(document, text, token);
      case 'tmpFile':
        return await this.formatWithTmpFile(document, text, token);
      default:
        throw new Error(`Unsupported StandardRB formatting mode: ${mode}`);
    }
  }

  private async formatAfterSave(
    document: vscode.TextDocument,
    text: string,
    token?: vscode.CancellationToken,
  ): Promise<string | undefined> {
    const saved = await document.save();
    if (!saved) {
      this.context.log.warn(
        'StandardRb: Document save canceled, not formatting',
        vscode.workspace.asRelativePath(document.uri),
      );
      return;
    }

    return await this.runStandardRb(document.uri, text, true, token);
  }

  private async formatWithTmpFile(
    _document: vscode.TextDocument,
    text: string,
    token?: vscode.CancellationToken,
  ): Promise<string | undefined> {
    let tmpFilePath: string | undefined;
    try {
      const tmpDirPath = await this.ensureTmpDir();
      tmpFilePath = join(tmpDirPath, `buffer-${Date.now()}-${Math.random().toString(36)}`);
      await fsPromises.writeFile(tmpFilePath, text);
      return await this.runStandardRb(vscode.Uri.file(tmpFilePath), text, false, token);
    } finally {
      if (tmpFilePath) {
        await fsPromises.unlink(tmpFilePath).catch((reason) => {
          this.context.log.error(`StandardRb: Failed to delete: ${tmpFilePath}`, reason);
        });
      }
    }
  }

  private getFormattingMode(uri: vscode.Uri, isRange: boolean | undefined): FormattingMode {
    return isRange
      ? 'tmpFile'
      : this.context.configuration.getValue<FormattingMode>(
          uri,
          'standardRubyFormattingMode',
          'tmpFile',
        );
  }

  protected override isSuccessCode(code: number): boolean {
    // 0: no changes, 1: `--fix` did not fix everything
    return code === 0 || code === 1;
  }

  private async runStandardRb(
    uri: vscode.Uri,
    text: string,
    useOpenDocument: boolean,
    token: vscode.CancellationToken | undefined,
  ): Promise<string> {
    await this.run(text, uri, { args: ['--fix', uri.fsPath] }, token);
    return useOpenDocument
      ? vscode.workspace.openTextDocument(uri).then((doc) => doc.getText())
      : fsPromises.readFile(uri.fsPath, { encoding: 'utf8' });
  }
}

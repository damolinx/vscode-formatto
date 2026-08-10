import * as vscode from 'vscode';
import { randomUUID } from 'crypto';
import { existsSync, promises as fsPromises, rmSync } from 'fs';
import { tmpdir } from 'os';
import { extname, join } from 'path';
import { ExtensionContext } from '../../extensionContext';
import { Formatter, FormatterCommand } from '../formatter';
import { StandardRbFormatterSpec } from './standardrbSpec';

export type FormattingMode = 'forceSave' | 'tmpFile';

export class StandardRbFormatter extends Formatter {
  private tmpDirPath?: vscode.Uri;

  constructor(context: ExtensionContext) {
    super(context, StandardRbFormatterSpec);
    this.disposables.push({
      dispose: () => {
        if (this.tmpDirPath) {
          try {
            rmSync(this.tmpDirPath.fsPath, { recursive: true });
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

  public override buildFormatCommand(
    scope: vscode.ConfigurationScope | undefined,
    uris?: readonly vscode.Uri[],
    ...additionalArgs: string[]
  ): FormatterCommand {
    return this.buildCommand(
      scope,
      '--fix',
      ...(uris?.map(({ fsPath }) => fsPath) ?? []),
      ...additionalArgs,
      ...this.getFormatConfiguredArgs(scope),
    );
  }

  private async ensureTmpDir(): Promise<vscode.Uri> {
    if (!this.tmpDirPath || !existsSync(this.tmpDirPath.fsPath)) {
      this.tmpDirPath = vscode.Uri.file(await fsPromises.mkdtemp(join(tmpdir(), 'formatto')));
    }
    return this.tmpDirPath;
  }

  protected async formatDocumentCore(
    document: vscode.TextDocument,
    range?: vscode.Range,
    token?: vscode.CancellationToken,
  ): Promise<string | undefined> {
    let newText: string | undefined;

    const originalText = document.getText(range);
    const mode = this.getFormattingMode(!!range, document.uri);
    this.context.log.debug(`${this.spec.id}: Using formatting mode: '${mode}'`);
    switch (mode) {
      case 'forceSave':
        newText = await this.formatAfterSave(document, token);
        break;
      case 'tmpFile':
        newText = await this.formatWithTemporaryFile(document, originalText, token);
        break;
      default:
        throw new Error(`Unsupported ${this.spec.id} formatting mode: ${mode}`);
    }

    return newText !== originalText ? newText : undefined;
  }

  private async formatAfterSave(
    document: vscode.TextDocument,
    token?: vscode.CancellationToken,
  ): Promise<string | undefined> {
    const saved = document.isDirty ? await document.save() : true;
    if (!saved) {
      this.context.log.warn(
        `${this.spec.id}: Document save canceled, not formatting. ${document.uri.fsPath}`,
      );
      return;
    }

    await this.execute(this.buildFormatCommand(document.uri, [document.uri]), undefined, token);

    // Ensure formatted content is read as document might not reload immediately.
    return await this.readFile(document.uri);
  }

  private async formatWithTemporaryFile(
    document: vscode.TextDocument,
    text: string,
    token?: vscode.CancellationToken,
  ): Promise<string | undefined> {
    let tmpFile: vscode.Uri | undefined;
    try {
      const tmpDir = await this.ensureTmpDir();
      tmpFile = vscode.Uri.joinPath(
        tmpDir,
        `buffer-${Date.now()}-${randomUUID().slice(0, 8)}${extname(document.uri.fsPath)}`,
      );

      await fsPromises.writeFile(tmpFile.fsPath, text, { encoding: 'utf8' });
      await this.execute(this.buildFormatCommand(document.uri, [tmpFile]), undefined, token);
      return await this.readFile(tmpFile);
    } finally {
      if (tmpFile) {
        await fsPromises.unlink(tmpFile.fsPath).catch((reason) => {
          this.context.log.error(`${this.spec.id}: Failed to delete: ${tmpFile}`, reason);
        });
      }
    }
  }

  private getFormattingMode(
    formattingRange: boolean,
    scope: vscode.ConfigurationScope,
  ): FormattingMode {
    if (formattingRange) {
      return 'tmpFile';
    }
    return this.context.configuration.getValue<FormattingMode>(
      scope,
      'standardrbFormattingMode',
      'tmpFile',
    );
  }

  protected override async execute(
    command: FormatterCommand,
    options?: {
      env?: NodeJS.ProcessEnv;
      stdin?: string;
      errorStream?: 'stderr' | 'stdout';
    },
    token?: vscode.CancellationToken,
  ): Promise<{ stdout: string; stderr: string }> {
    try {
      return await super.execute(
        command,
        { ...options, env: { ...process.env, ...options?.env } },
        token,
      );
    } catch (error) {
      // StandardRB returns exit code 1 for auto-correctable offenses.
      if (error instanceof Error && (error as any).code === 1) {
        this.context.log.warn(
          `${this.spec.id}: ${error.message?.replace(/standard:.+?\n\s+/, '')}`,
        );
        return { stdout: '', stderr: '' };
      }
      throw error;
    }
  }

  private async readFile({ fsPath }: vscode.Uri): Promise<string> {
    const newText = await fsPromises.readFile(fsPath, { encoding: 'utf8' });
    return newText;
  }
}

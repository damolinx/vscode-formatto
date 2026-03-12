import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { verifyRubyfmt, VerifyRubyfmtOptions } from './commands/verifyRubyfmt';
import { ExtensionContext } from './extensionContext';

export interface FormatExecutionOptions {
  cwd?: string;
  resolvedRubyfmtPath: string;
}

export async function formatDocument(
  context: ExtensionContext,
  document: vscode.TextDocument,
  options?: FormatExecutionOptions,
  token?: vscode.CancellationToken,
): Promise<string> {
  const text = document.getText();
  if (text.length === 0) {
    return text;
  }

  const formattedText = await formatText(context, document.getText(), document.uri, options, token);
  return formattedText;
}

export async function formatText(
  context: ExtensionContext,
  text: string,
  uri: vscode.Uri,
  options?: FormatExecutionOptions,
  token?: vscode.CancellationToken,
): Promise<string> {
  const {
    resolvedRubyfmtPath = context.configuration.getRubyfmtPath(uri),
    cwd = vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath,
  } = options ?? {};

  context.log.info(`Running: '${resolvedRubyfmtPath}'${cwd ? `. Cwd: '${cwd}'` : ''}`);
  const formattedText = new Promise<string>((resolve, reject) => {
    const child = spawn(resolvedRubyfmtPath, [], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const cancelSubscription = token?.onCancellationRequested(() => {
      child.kill('SIGKILL');
      reject();
    });

    let stderr = '';
    let stdout = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (err: NodeJS.ErrnoException) => {
      const message =
        err.code && ['EACCES', 'ENOENT'].includes(err.code)
          ? `'${resolvedRubyfmtPath}' not found`
          : 'rubyfmt failed';
      reject(new Error(message, { cause: err }));
    });
    child.on('close', (code) => {
      cancelSubscription?.dispose();
      if (token?.isCancellationRequested) {
        return; // already canceled
      }

      if (code !== 0) {
        reject(new Error(`rubyfmt exited with code ${code}: ${stderr.trim()} `));
      } else {
        resolve(stdout);
      }
    });

    child.stdin.write(text);
    child.stdin.end();
  });
  return formattedText;
}

export async function tryFormatDocument(
  context: ExtensionContext,
  document: vscode.TextDocument,
  token?: vscode.CancellationToken,
): Promise<string | undefined> {
  const options: VerifyRubyfmtOptions & FormatExecutionOptions = {
    resolvedRubyfmtPath: context.configuration.getRubyfmtPath(document.uri),
    cwd: vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath,
    scope: document.uri,
  };
  if (!(await verifyRubyfmt(context, options))) {
    return;
  }

  let formattedText: string | undefined;
  try {
    formattedText = await formatDocument(context, document, options, token);
  } catch (e) {
    const message = e instanceof Error ? e.message : (e?.toString() ?? 'unknown');
    context.log.error(
      `Failed to format '${vscode.workspace.asRelativePath(document.uri)}'. Error: ${message}`,
    );
  }
  return formattedText;
}

export async function tryFormatText(
  context: ExtensionContext,
  document: vscode.TextDocument,
  range: vscode.Range,
  token?: vscode.CancellationToken,
): Promise<string | undefined> {
  const options: VerifyRubyfmtOptions & FormatExecutionOptions = {
    resolvedRubyfmtPath: context.configuration.getRubyfmtPath(document.uri),
    cwd: vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath,
    scope: document.uri,
  };
  if (!(await verifyRubyfmt(context, options))) {
    return;
  }

  let formattedText: string | undefined;
  try {
    formattedText = await formatText(
      context,
      document.getText(range),
      document.uri,
      options,
      token,
    );
  } catch (e) {
    const rangeString = `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
    const message = e instanceof Error ? e.message : (e?.toString() ?? 'unknown');
    context.log.error(
      `Failed to format '${vscode.workspace.asRelativePath(document.uri)}'. Range: ${rangeString}. Error: ${message}`,
    );
  }
  return formattedText;
}

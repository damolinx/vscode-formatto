import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { ExtensionContext } from './extensionContext';

export async function formatDocument(
  context: ExtensionContext,
  document: vscode.TextDocument,
  token: vscode.CancellationToken,
): Promise<string> {
  const text = document.getText();
  if (text.length === 0) {
    return text;
  }

  const formattedText = await formatText(context, document.getText(), document.uri, token);
  return formattedText;
}

export async function formatText(
  context: ExtensionContext,
  text: string,
  uri: vscode.Uri,
  token: vscode.CancellationToken,
): Promise<string> {
  const rubyfmtPath = context.configuration.getRubyfmtPath(uri);
  const workspaceFolder = uri && vscode.workspace.getWorkspaceFolder(uri)?.uri;

  context.log.info(
    `Running: ${rubyfmtPath}${workspaceFolder ? ` (cwd: ${workspaceFolder.fsPath})` : ''}`,
  );
  const formattedSource = new Promise<string>((resolve, reject) => {
    const child = spawn(rubyfmtPath, [], {
      cwd: workspaceFolder?.fsPath,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const cancelSubscription = token.onCancellationRequested(() => {
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
    child.on('error', (err) => {
      reject(new Error(`Failed to spawn rubyfmt: ${err.message}`));
    });
    child.on('close', (code) => {
      cancelSubscription.dispose();
      if (token.isCancellationRequested) {
        return; // already canceled
      }

      if (code !== 0) {
        reject(new Error(`rubyfmt exited with code ${code}: ${stderr.trim()}`));
      } else {
        resolve(stdout);
      }
    });

    child.stdin.write(text);
    child.stdin.end();
  });
  return formattedSource;
}

export async function tryFormatDocument(
  context: ExtensionContext,
  document: vscode.TextDocument,
  token: vscode.CancellationToken,
): Promise<string | undefined> {
  let formattedSource: string | undefined;
  try {
    formattedSource = await formatDocument(context, document, token);
  } catch (e) {
    const message = e instanceof Error ? e.message : (e?.toString() ?? 'Failed to format document');
    context.log.error(message, vscode.workspace.asRelativePath(document.uri));
  }
  return formattedSource;
}

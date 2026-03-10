import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { ExtensionContext } from './extensionContext';

export async function rubyfmt(
  context: ExtensionContext,
  source: string,
  token: vscode.CancellationToken,
): Promise<string> {
  const rubyfmtPath = context.configuration.getRubyFmtPath();
  const formattedSource = new Promise<string>((resolve, reject) => {
    const child = spawn(rubyfmtPath, [], {
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
        reject(new Error(`rubyfmt exited with code ${code}: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });

    child.stdin.write(source);
    child.stdin.end();
  });
  return formattedSource;
}

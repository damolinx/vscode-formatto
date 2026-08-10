import * as vscode from 'vscode';
import * as os from 'os';

// Maximum argument bytes safe for most systems
export const MAX_ARG_BYTES = 128 * 1024;
// Minimum number of files per process to avoid spawning too many processes for small batches.
export const MIN_FILES_PER_PROCESS = 10;

export function buildBatches(
  uris: readonly vscode.Uri[],
  maxConcurrency?: number,
  maxArgBytes = MAX_ARG_BYTES,
): vscode.Uri[][] {
  if (uris.length === 0) {
    return [];
  }

  const initialBatchCount = Math.max(
    1,
    Math.min(maxConcurrency ?? os.cpus().length, Math.ceil(uris.length / MIN_FILES_PER_PROCESS)),
  );
  const batches = Array.from({ length: initialBatchCount }, () => [] as vscode.Uri[]);
  for (const [index, uri] of uris.entries()) {
    batches[index % initialBatchCount].push(uri);
  }

  return batches.flatMap((batch) => splitBatch(batch, maxArgBytes));
}

function splitBatch(uris: readonly vscode.Uri[], maxArgBytes: number): vscode.Uri[][] {
  const batches: vscode.Uri[][] = [];

  let current: vscode.Uri[] = [];
  let currentBytes = 0;

  for (const uri of uris) {
    const bytes = Buffer.byteLength(uri.fsPath, 'utf8') + 1;

    if (current.length > 0 && currentBytes + bytes > maxArgBytes) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }

    current.push(uri);
    currentBytes += bytes;
  }

  if (current.length > 0) {
    batches.push(current);
  }

  return batches;
}

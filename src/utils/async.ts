import * as vscode from 'vscode';

export class CancellationError extends Error {
  constructor(message = 'Operation was canceled') {
    super(message);
    this.name = 'CancellationError';
  }
}

export function createCancellationPromise(token: vscode.CancellationToken): Promise<never> {
  if (token.isCancellationRequested) {
    return Promise.reject(new CancellationError());
  }

  return new Promise((_, reject) => {
    token.onCancellationRequested(() => reject(new CancellationError()));
  });
}

export async function runWithConcurrencyLimit<T>(
  items: Iterable<T>,
  limit: number,
  fn: (item: T, index: number, token: vscode.CancellationToken) => Promise<any>,
  token: vscode.CancellationToken,
): Promise<void> {
  const executing = new Set<Promise<void>>();

  let batchIndex = 0;
  let firstError: Error | undefined;

  for (const item of items) {
    if (firstError || token.isCancellationRequested) {
      break;
    }

    const p = Promise.resolve()
      .then(() => fn(item, batchIndex++, token))
      .catch((error) => {
        firstError ??= error;
      })
      .finally(() => {
        executing.delete(p);
      });

    executing.add(p);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.allSettled(executing);

  if (token.isCancellationRequested) {
    throw new CancellationError();
  }

  if (firstError) {
    throw firstError;
  }
}

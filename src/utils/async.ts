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
  fn: (item: T, token: vscode.CancellationToken) => Promise<void>,
  token: vscode.CancellationToken,
): Promise<void> {
  const executing = new Set<Promise<void>>();
  const cancelPromise = createCancellationPromise(token);

  for (const item of items) {
    if (token.isCancellationRequested) {
      throw new CancellationError();
    }

    const p = Promise.race([fn(item, token), cancelPromise]).finally(() => executing.delete(p));

    executing.add(p);

    if (executing.size >= limit) {
      await Promise.race([Promise.race(executing), cancelPromise]);
    }
  }

  await Promise.race([Promise.all(executing), cancelPromise]);
}

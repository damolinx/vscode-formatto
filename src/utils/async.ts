import * as vscode from 'vscode';

export function createCancellationPromise(token: vscode.CancellationToken): Promise<never> {
  if (token.isCancellationRequested) {
    return Promise.reject(new Error('Cancelled'));
  }

  return new Promise((_, reject) => {
    token.onCancellationRequested(() => reject(new Error('Cancelled')));
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
      throw new Error('Cancelled');
    }

    const p = Promise.race([fn(item, token), cancelPromise]).finally(() => executing.delete(p));

    executing.add(p);

    if (executing.size >= limit) {
      await Promise.race([Promise.race(executing), cancelPromise]);
    }
  }

  await Promise.race([Promise.all(executing), cancelPromise]);
}

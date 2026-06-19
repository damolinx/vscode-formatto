import * as vscode from 'vscode';

export async function createCancellationPromise(
  token: vscode.CancellationToken,
): Promise<Promise<never>> {
  return new Promise((_, reject) => {
    token.onCancellationRequested(() => reject(new Error('Cancelled')));
  });
}

export async function runWithConcurrencyLimit<T>(
  items: Iterable<T>,
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const executing = new Set<Promise<void>>();

  for (const item of items) {
    const p = fn(item).finally(() => executing.delete(p));
    executing.add(p);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
}

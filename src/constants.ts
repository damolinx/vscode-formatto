import * as vscode from 'vscode';

export const EXTENSION_PREFIX = 'formatto';

export const DOCUMENT_SELECTOR: readonly vscode.DocumentFilter[] = [
  { language: 'ruby' },
  { language: 'gemfile' },
];

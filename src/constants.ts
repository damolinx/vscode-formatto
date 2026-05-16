import * as vscode from 'vscode';

export const EXTENSION_PREFIX = 'formatto';

export const DOCUMENT_SELECTOR: readonly vscode.DocumentFilter[] = [
  { language: 'erb' },
  { language: 'gemfile' },
  { language: 'ruby' },
];

export const SUPPORTED_RUBY_EXTENSIONS: readonly string[] = [
  '.rb',
  '.rbs',
  '.rbi',
  '.gemspec',
  '.podspec',
];

import * as vscode from 'vscode';

export const EXTENSION_PREFIX = 'formatto';

export const PACKAGE_FILENAME = '__package.rb';

export const DOCUMENT_SELECTOR: Readonly<vscode.DocumentFilter> = {
  language: 'ruby',
  scheme: 'file',
};

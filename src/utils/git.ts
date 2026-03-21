import * as vscode from 'vscode';
import type { API as GitAPI } from '../../typings/git';
import { ExtensionContext } from '../extensionContext';

export function getGitApi({ log }: ExtensionContext): GitAPI | undefined {
  const gitExtension = vscode.extensions.getExtension('vscode.git');
  if (!gitExtension) {
    log.warn('Git: vscode.git extension missing or failed to load.');
    return;
  }

  const git = gitExtension.exports as { getAPI(version: number): GitAPI };
  return git.getAPI(1);
}

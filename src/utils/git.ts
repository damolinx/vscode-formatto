import * as vscode from 'vscode';
import type { API as GitAPI } from '../../typings/git';

export function getGitApi(): GitAPI | undefined {
  const gitExtension = vscode.extensions.getExtension('vscode.git');
  if (!gitExtension) {
    return;
  }

  const git = gitExtension.exports as { getAPI(version: number): GitAPI };
  return git.getAPI(1);
}

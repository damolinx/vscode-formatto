import * as vscode from 'vscode';
import type { API } from '../../typings/git';

interface GitExtension {
  getAPI(version: number): API;
}

export function getGitApi(): API | undefined {
  const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
  if (!gitExtension) {
    return;
  }

  return gitExtension.exports.getAPI(1);
}

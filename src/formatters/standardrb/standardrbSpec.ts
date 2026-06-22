import * as vscode from 'vscode';
import { COMMON_RUBY_EXTENSIONS } from '../../constants';
import { FormatterSpec } from '../formatterSpec';

export const StandardRbFormatterSpec: FormatterSpec = {
  id: 'standardrb',
  name: 'Standard Ruby',

  docs: { installation: vscode.Uri.parse('https://github.com/standardrb/standard#install') },

  supportedExtensions: COMMON_RUBY_EXTENSIONS,
  supportedLanguages: ['gemfile', 'ruby'],

  supportsBundler: true,
};

import * as vscode from 'vscode';
import { COMMON_RUBY_EXTENSIONS } from '../../constants';
import { FormatterSpec } from '../formatterSpec';

export const RufoFormatterSpec: FormatterSpec = {
  id: 'rufo',
  name: 'Rufo',

  docs: {
    installation: vscode.Uri.parse(
      'https://github.com/ruby-formatter/rufo?tab=readme-ov-file#installation',
    ),
  },

  supportedExtensions: COMMON_RUBY_EXTENSIONS.concat(['.erb', '.rhtml']),
  supportedLanguages: ['gemfile', 'erb', 'ruby'],
  supportsBundler: true,
};

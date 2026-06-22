import * as vscode from 'vscode';
import { COMMON_RUBY_EXTENSIONS } from '../../constants';
import { FormatterSpec } from '../formatterSpec';

export const RubyfmtFormatterSpec: FormatterSpec = {
  id: 'rubyfmt',
  name: 'Rubyfmt',

  docs: {
    installation: vscode.Uri.parse(
      'https://github.com/fables-tales/rubyfmt?tab=readme-ov-file#installation',
    ),
  },

  supportedExtensions: COMMON_RUBY_EXTENSIONS,
  supportedLanguages: ['gemfile', 'ruby'],

  supportsBundler: false,
};

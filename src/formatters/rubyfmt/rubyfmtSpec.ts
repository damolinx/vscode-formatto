import { COMMON_RUBY_EXTENSIONS } from '../../constants';
import { FormatterSpec } from '../formatterSpec';

export const RubyfmtFormatterSpec: FormatterSpec = {
  id: 'rubyfmt',
  name: 'Rubyfmt',

  docs: {
    installation: 'https://github.com/fables-tales/rubyfmt?tab=readme-ov-file#installation',
    project: 'https://github.com/fables-tales/rubyfmt?tab=readme-ov-file',
  },

  supportedExtensions: COMMON_RUBY_EXTENSIONS,
  supportedLanguages: ['gemfile', 'ruby'],

  supportsBundler: false,
};

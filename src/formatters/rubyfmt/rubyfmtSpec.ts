import { COMMON_RUBY_EXTENSIONS } from '../../constants';
import { DEFAULT_FORMATTER_TIMEOUTS, FormatterSpec } from '../formatterSpec';

export const RubyfmtFormatterSpec: FormatterSpec = {
  id: 'rubyfmt',
  name: 'Rubyfmt',

  docs: {
    installation: 'https://github.com/fables-tales/rubyfmt?tab=readme-ov-file#installation',
    project: 'https://github.com/fables-tales/rubyfmt?tab=readme-ov-file',
  },

  supportsBundler: false,
  supportedExtensions: COMMON_RUBY_EXTENSIONS,
  supportedLanguages: ['gemfile', 'ruby'],

  timeouts: DEFAULT_FORMATTER_TIMEOUTS,
};

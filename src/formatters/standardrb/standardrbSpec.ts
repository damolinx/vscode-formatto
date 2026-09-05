import { COMMON_RUBY_EXTENSIONS } from '../../constants';
import { FormatterSpec } from '../formatterSpec';

export const StandardRbFormatterSpec: FormatterSpec = {
  id: 'standardrb',
  name: 'Standard Ruby',

  docs: {
    installation: 'https://github.com/standardrb/standard#install',
    project: 'https://github.com/standardrb/standard',
  },

  supportsBundler: true,
  supportedExtensions: COMMON_RUBY_EXTENSIONS,
  supportedLanguages: ['gemfile', 'ruby'],

  timeouts: {
    formatting: 10000,
    version: 5000,
  },
};

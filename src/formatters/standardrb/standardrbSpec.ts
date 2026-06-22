import { COMMON_RUBY_EXTENSIONS } from '../../constants';
import { FormatterSpec } from '../formatterSpec';

export const StandardRbFormatterSpec: FormatterSpec = {
  id: 'standardrb',
  name: 'Standard Ruby',

  docs: {
    installation: 'https://github.com/standardrb/standard#install',
    project: 'https://github.com/standardrb/standard',
  },

  supportedExtensions: COMMON_RUBY_EXTENSIONS,
  supportedLanguages: ['gemfile', 'ruby'],

  supportsBundler: true,
};

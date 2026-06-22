import { COMMON_RUBY_EXTENSIONS } from '../../constants';
import { FormatterSpec } from '../formatterSpec';

export const RufoFormatterSpec: FormatterSpec = {
  id: 'rufo',
  name: 'Rufo',

  docs: {
    installation: 'https://github.com/ruby-formatter/rufo?tab=readme-ov-file#installation',
    project: 'https://github.com/ruby-formatter/rufo',
  },

  supportedExtensions: COMMON_RUBY_EXTENSIONS.concat(['.erb', '.rhtml']),
  supportedLanguages: ['gemfile', 'erb', 'ruby'],
  supportsBundler: true,
};

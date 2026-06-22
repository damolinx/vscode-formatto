import { FormatterId } from './formatterId';

export interface FormatterSpec {
  id: FormatterId;
  name: string;

  docs: Readonly<{
    installation?: string;
    project?: string;
  }>;

  supportedExtensions: readonly string[];
  supportedLanguages: readonly string[];

  supportsBundler: boolean;
}

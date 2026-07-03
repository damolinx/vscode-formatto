import { FormatterId } from './formatterId';

export const DEFAULT_FORMATTER_TIMEOUTS = {
  formatting: 5000,
  version: 1000,
} as const;

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

  timeouts: {
    formatting: number;
    version: number;
  };
}

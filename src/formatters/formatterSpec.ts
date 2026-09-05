import { FormatterId } from './formatterId';

export interface FormatterTimeouts {
  formatting: number;
  version: number;
}

export const DEFAULT_FORMATTER_TIMEOUTS: Readonly<FormatterTimeouts> = {
  formatting: 5000,
  version: 1000,
};

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

  timeouts: Readonly<FormatterTimeouts>;
}

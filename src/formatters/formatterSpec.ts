import { FormatterName } from './formatterName';

export interface FormatterDocs {
  readonly installation?: string;
}

export interface FormatterSpec {
  readonly docs?: FormatterDocs;
  readonly injectsTrailingNewline: boolean;
  readonly name: FormatterName;
  readonly versionArgs?: string[];
}

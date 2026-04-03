export type FormatterName = 'rubyfmt' | 'rufo';

export interface FormatterDescriptor {
  readonly id: FormatterName;
  readonly installUrl: string;
  readonly versionArgs?: string[];
}

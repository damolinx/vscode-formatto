export type FormatterName = 'rubyfmt' | 'rufo' | 'standardrb';

export interface FormatterDescriptor {
  readonly id: FormatterName;
  readonly injectsTrailingNewline: boolean;
  readonly installUrl: string;
  readonly versionArgs?: string[];
}

export function capitalizeFormatterName(id: FormatterName): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

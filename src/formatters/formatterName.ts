export type FormatterName = 'rubyfmt' | 'rufo' | 'standardrb';

export function capitalizeFormatterName(id: FormatterName): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

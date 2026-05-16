export type FormatterName = 'rubyfmt' | 'rufo' | 'standardrb';

export function capitalizeName(name: FormatterName): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

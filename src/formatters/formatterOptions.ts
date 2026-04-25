export interface FormatterOptions {
  /** Command arguments. {@link getFormatterArgs} are always appended to these. */
  args?: string[];
  /** Command. If omitted, {@link getFormatterCommand} is used. */
  cmd?: string;
  /** Command working dir. If omitted, the workspace or parent dir of the scope URI is used. */
  cwd?: string;
}

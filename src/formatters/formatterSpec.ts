import { FormatterName } from './formatterName';

/**
 * Formatter metadata.
 */
export interface FormatterSpec {
  /** Whether the formatter always appends a trailing newline. */
  readonly appendsTrailingNewline: boolean;

  /** Documentation links. */
  readonly docs?: {
    /** Installation instructions. */
    readonly installation?: string;
  };

  /**
   * Formatter input mode:
   * - `stdin`: formatter reads document text from stdin.
   * - `file`: formatter reads the file from disk.
   */
  readonly inputKind: 'file' | 'stdin';

  /** Formatter identifier. */
  readonly name: FormatterName;

  /** Timeout settings. */
  readonly timeouts?: {
    /** Formatting timeout (ms). */
    readonly executionMs?: number;

    /** Verification timeout (ms). */
    readonly verificationMs?: number;
  };

  /** Arguments used to query the formatter version. */
  readonly versionArgs?: string[];
}

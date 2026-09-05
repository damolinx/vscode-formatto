# Formatto

Formatto is a flexible Ruby formatter for VS Code supporting [rubyfmt](https://github.com/fables-tales/rubyfmt), [rufo](https://github.com/ruby-formatter/rufo), and [standardrb](https://github.com/standardrb/standard). It is **multi‑root** aware, allowing each workspace folder to configure its own formatter. Formatto also supports formatting Ruby notebook cells.

The extension enables the built‑in [**Format Document**](#format-document) command for Ruby files, allowing `editor.formatOnSave` to work with Ruby files. Ruby formatters do not support range formatting, so Formatto uses a heuristic to enable the [**Format Selection**](#format-selection) command. While useful, it has edge cases and is therefore disabled by default to avoid confusion. It can be enabled with a simple [configuration](#configuration) change.

The custom [**Format Pending Changes**](#format-pending-changes) command lets you format all Ruby files with pending changes in your current Git repository, streamlining cleanup before staging or committing.


## Table of Contents
- [Getting Started](#getting-started)
- [Configuration](#configuration)
  - [Rubyfmt](#rubyfmt)
  - [Rufo](#rufo)
  - [Standard Ruby](#standard-ruby)
- [Commands](#commands)
  - [Format Document](#format-document)
  - [Format Pending Changes](#format-pending-changes)
  - [Format Selection](#format-selection)
- [Logs](#logs)

## Getting Started

1. Make sure your preferred formatter is installed on your system.  
   - Installation guides: [rubyfmt](https://github.com/fables-tales/rubyfmt?tab=readme-ov-file#installation), [rufo](https://github.com/ruby-formatter/rufo?tab=readme-ov-file#installation), [standardrb](https://github.com/standardrb/standard#install)

2. Configure Formatto to use your formatter with the `formatto.formatter` setting (*rubyfmt* is the default if omitted).
   - You can configure this at the User, Workspace, or Workspace Folder settings level. Refer to [Settings Precedence](https://code.visualstudio.com/docs/configure/settings#_settings-precedence) documentation for further details.

3. Ensure that Formatto can locate the selected formatter. Any one of the following options is sufficient:

   - The formatter executable is available on your system `PATH`. If it was added while VS Code was already running, restart VS Code.
   - The formatter executable path is configured using `formatto.rubyfmtPath`, `formatto.rufoPath`, or `formatto.standardrbPath`.
   - Either `formatto.rufoPreferBundler` or `formatto.standardrbPreferBundler` is enabled to run the formatter via `bundle exec` (*rubyfmt* does not support Bundler).
  
   Whichever option you choose, Formatto verifies that it can run the selected formatter and caches successful verification results for the session.

Once configured, use the built‑in **Format Document** command, or enable **Editor: Format on Save** to format automatically on save. See [Format Selection](#format-selection) for details on formatting a selection range.

## Configuration

The following settings apply regardless of which formatter is selected.

| Setting | Description | Default |
|---------|-------------|---------|
| `formatto.additionalSupportedExtensions` | Additional file extensions to accept for formatting, in addition to each formatter's built‑in supported extensions. Applies only to files already recognized as `ruby`, `gemfile`, or `erb`. | |
| `formatto.enableRangeFormatting` | Enables experimental support for **Format Selection**. | `false` |
| `formatto.excludePatterns` | Glob patterns for files that should not be formatted, e.g., `**/__package.rb`, `vendor/**/*`. | |
| `formatto.formatter` | Formatter to use. | `rubyfmt` |

For every formatter, there is a `formatto.«formatter»Path` setting whose value defaults to the executable name, e.g., `rubyfmt`, which is resolved from the system `PATH`. If the formatter cannot be located through `PATH`, configure an explicit executable path instead. The following replacement tokens are available when defining this path:

* `${userHome}`: Home directory of the current user.
* `${workspaceFolder}`: Workspace folder containing the file being formatted.

#### Exclude Patterns
`formatto.excludePatterns` lets you prevent specific files from being formatted. This is useful for files that should never be rewritten, such as generated sources or special Ruby files like `__package.rb`.

Patterns use `minimatch` glob syntax and are matched against workspace-relative paths. If a file matches any pattern, Formatto skips formatting it. 

### Rubyfmt

| Setting | Description | Default |
|---------|-------------|---------|
| `formatto.rubyfmtArgs` | Additional arguments to pass to `rubyfmt`, e.g., `--header-opt-in`. | |
| `formatto.rubyfmtMaxConcurrency` | Maximum number of concurrent processes that may be launched. `0` uses the number of logical CPU cores. | 0 |
| `formatto.rubyfmtPath` | Path to `rubyfmt`. | `rubyfmt` | 
| `formatto.verifyRubyfmt` | Verify that `rubyfmt` is available before formatting. The check repeats until successful, then is cached for the session. | `true` |

Supported extensions: `.rb`, `.rbs`, `.rbi`, `.gemspec`, `.podspec`. Use [`formatto.additionalSupportedExtensions`](#configuration) to add extra extensions.

### Rufo

| Setting | Description | Default |
|---------|-------------|---------|
| `formatto.rufoArgs` | Additional arguments to pass to `rufo`. | |
| `formatto.rufoMaxConcurrency` | Maximum number of concurrent processes that may be launched. `0` uses the number of logical CPU cores. | 0 |
| `formatto.rufoPath` | Path to `rufo`. | `rufo` |
| `formatto.rufoPreferBundler` | Prefer running `rufo` via `bundle exec`. | `false` |
| `formatto.verifyRufo` | Verify that `rufo` is available before formatting. The check repeats until successful, then is cached for the session. | `true` |

Supported extensions: `.rb`, `.rbs`, `.rbi`, `.gemspec`, `.podspec`, `.erb`, `.rhtml`. Use [`formatto.additionalSupportedExtensions`](#configuration) to add extra extensions.

Rufo automatically loads `.rufo` configuration files when present. See the [Rufo documentation](https://github.com/ruby-formatter/rufo?tab=readme-ov-file#configuration) for details.

[↑ Back to top](#table-of-contents)

### Standard Ruby

| Setting | Description | Default |
|---------|-------------|---------|
| `formatto.standardrbArgs` | Additional arguments to pass to `standardrb`. | |
| `formatto.standardrbFormattingMode` | Controls how Formatto satisfies `standardrb`'s requirement to operate on real files. | `tmpFile` |
| `formatto.standardrbMaxConcurrency` | Maximum number of concurrent processes that may be launched. `0` uses the number of logical CPU cores. | 0 |
| `formatto.standardrbPath` | Path to `standardrb`. | `standardrb` |
| `formatto.standardrbPreferBundler` | Prefer running `standardrb` via `bundle exec`. | `false` |
| `formatto.verifyStandardrb` | Verify that `standardrb` is available before formatting. The check repeats until successful, then is cached for the session. | `true` |

Supported extensions: `.rb`, `.rbs`, `.rbi`, `.gemspec`, `.podspec`. Use [`formatto.additionalSupportedExtensions`](#configuration) to add extra extensions.

#### Save-to-disk behavior
*Standard Ruby* differs from *rubyfmt* and *rufo* because it can only format files on disk. Formatto provides the following modes to address this limitation (configurable via the `formatto.standardrbFormattingMode` setting):

* *tmpFile*: writes the editor contents to a temporary file, formats that file, and applies the resulting changes back to the editor. This is slower due to the additional file system operations, but avoids an unexpected save of the document and is therefore the default behavior. The extension attempts to clean up these temporary files immediately, so they should not accumulate.
* *forceSave*: saves the document to disk before formatting it. This is not the default mode because it changes VS Code's standard formatter behavior in a significant way, but it may be preferred if you work on large files (to avoid additional I/O overhead).

When the editor has no pending changes, `standardrb` runs directly against the file on disk, allowing VS Code to detect the resulting content change.

[↑ Back to top](#table-of-contents)

## Commands

### Format Document

When Formatto is set as the **default formatter** for supported Ruby files, the built‑in **Format Document** command automatically uses it. This also applies to **Format on Save**.

If your project uses another formatter, or you simply want to try Formatto without switching defaults, you can run it on demand using the built‑in command **Format Document With…**. This lets you choose Formatto for a single formatting operation without modifying your workspace settings. This is the recommended way to try Formatto in projects that have not fully migrated yet.

### Format Pending Changes

Use the **Formatto: Format Pending Changes** command to format all modified Ruby files in Git repositories open in VS Code. This is a convenient option when you prefer not to enable **Format on Save**, or as the final step before opening a pull request. 

The command:
* is available only when **at least one Git repository** is open.
* **refreshes** the repository status known to VS Code. This could take a significant amount of time in some configurations, e.g., large monorepos. Check the [logs](#logs) for timing information.
* runs up to `formatto.«formatter»MaxConcurrency` formatter processes concurrently, while automatically batching files to avoid overwhelming the system.
* operates on files on disk. **Unsaved editor changes are not included until the file is saved.**

### Format Selection

Formatto implements **Format Selection** by sending the selected range to the formatter as if it were the full document, then applying a heuristic to map the result back. Ruby formatters normally operate only on complete, syntactically valid code. Incomplete or broken selections are not currently expanded or repaired by the heuristic, so no change is applied in those cases (see the logs for details). This feature is **experimental** and results may not match **Format Document**. 

> **DO NOT** report issues with selection formatting to the formatter projects. No Ruby formatter supports formatting arbitrary ranges of a file.

If you understand the limitations, the feature can still be very useful. To enable it, use the `formatto.enableRangeFormatting` setting. Changes to this setting take effect only after a restart.

### Verify Formatter
Use the **Formatto: Verify Formatter** command to run the verification process for the formatter associated with the current context (workspace folder or global configuration). If verification succeeds, a notification displays the detected formatter version. If verification fails, Formatto offers troubleshooting options such as viewing **Logs** or opening **Documentation**.

[↑ Back to top](#table-of-contents)

## Logs

Formatto writes diagnostic information to the **Formatto** output channel.
You can adjust the log level using **Developer: Set Log Level** and selecting **Formatto**.
See [documentation](https://code.visualstudio.com/updates/v1_73#_setting-log-level-per-output-channel) for details.

[↑ Back to top](#table-of-contents)

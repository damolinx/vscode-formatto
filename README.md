# Formatto

Formatto is a flexible Ruby formatter for VS Code supporting [rubyfmt](https://github.com/fables-tales/rubyfmt), [rufo](https://github.com/ruby-formatter/rufo), and [standardrb](https://github.com/standardrb/standard). It is **multi‑root** aware, allowing each workspace folder to use its own formatter and configuration.

In simple terms, the extension enables the built‑in [**Format Document**](#format-document) command for any Ruby file, allowing `editor.formatOnSave` to work with Ruby files. Ruby formatters do not support range formatting, so Formatto uses a heuristic to enable the [**Format Selection**](#format-selection) command. While useful, it has edge cases and therefore disabled by default to avoid confusion. It can be enabled with a simple [configuration](#configuration) change.

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

1. Make sure the formatter you selected is installed on your system.  
   - Installation guides: [rubyfmt](https://github.com/fables-tales/rubyfmt?tab=readme-ov-file#installation), [rufo](https://github.com/ruby-formatter/rufo?tab=readme-ov-file#installation), [standardrb](https://github.com/standardrb/standard#install)

2. Choose which formatter you want to use: *rubyfmt* (default), *rufo* or *standardrb*.  
   - Set the `"formatto.formatter"` from the appropriate settings JSON, or using the **Formatto: Formatter** option from the [Settings editor](https://code.visualstudio.com/docs/configure/settings#_settings-editor).
   - You can configure this at the User, Workspace and/or Workspace Folder settings level. Refer to [Settings Precedence](https://code.visualstudio.com/docs/configure/settings#_settings-precedence) documentation for further details.

3. Ensure that either:
  - executable is available on your system `PATH` (a restart may be required).  
  - the formatter location path is set using `"formatto.rubyfmtPath"`, `"formatto.rufoPath"` or `"formatto.standardrbPath"` settings.
  - you enable the appropriate `"formatto.rufoPreferBundler"` or `"formatto.standardrbPreferBundler"` setting to enable `bundle exec` use (*rubyfmt* does not support Bundler).
  
  > Whichever way you select, Formatto verifies that the selected formatter is reachable before executing it in the current session for the first time and it will prompt you for action if the given formatter cannot be found.

Once configured, use the built‑in **Format Document** command, or enable **Editor: Format on Save** to format automatically on save. See [Format Selection](#format-selection) for details on formatting a selection range.

### Choosing a formatter
This is up to you (or your project), but a few notes:
- **rubyfmt** provides deterministic, configuration‑free formatting. This is the **default** formatter used.
- **rufo** supports `.rufo` configuration and offers customizable formatting style.
- **standardrb** provides deterministic, configuration‑free formatting. Because it runs RuboCop rather than using a dedicated formatter, it is typically an order of magnitude slower than *rubyfmt* or *rufo* (as it is not used in LSP mode).

[↑ Back to top](#table-of-contents)

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `formatto.additionalSupportedExtensions` | Additional file extensions to accept for formatting, in addition to each formatter's built‑in supported extensions. Applies only to files already recognized as `ruby`, `gemfile`, or `erb`. | |
| `formatto.enableRangeFormatting` | Enables experimental support for **Format Selection**. | `false` |
| `formatto.excludePatterns` | Glob patterns for files that should not be formatted, e.g. `**/__package.rb`. | |
| `formatto.formatter` | Formatter to use for formatting. | `rubyfmt` |
| `formatto.formatPendingChanges.includeStaged` | Include staged changes when running **Format Pending Changes**. | `true` |

For every formatter, there is a `formatto.«formatter»Path` setting whose value defaults to the executable name, e.g. `rubyfmt`, which is resolved from the system `PATH`. 
If the formatter is not reachable like that, use a path. The following replacement tokens are available to define this path:

* `${userHome}`: User home directory  
* `${workspaceFolder}`: Workspace folder containing the file being formatted

#### Exclude Patterns
`formatto.excludePatterns` lets you prevent specific files from being formatted. Patterns use standard glob syntax (via `minimatch`) and are matched against the full file path. If a file matches any pattern, Formatto skips it entirely. This is useful for files that should never be rewritten, such as generated sources or special Ruby files like `__package.rb`.

### Rubyfmt

| Setting | Description | Default |
|---------|-------------|---------|
| `formatto.rubyfmtArgs` | Additional arguments to pass to `rubyfmt`, e.g. `--header-opt-in`. | |
| `formatto.rubyfmtPath` | Path to `rubyfmt`. | `rubyfmt` | 
| `formatto.verifyRubyfmt` | Verify that `rubyfmt` is available before formatting. The check repeats until successful, then is cached for the session. | `true` |

Supported extensions: `.rb`, `.rbs`, `.rbi`, `.gemspec`, `.podspec`. Use [`formatto.additionalSupportedExtensions`](#configuration) to add extra extensions.

### Rufo

| Setting | Description | Default |
|---------|-------------|---------|
| `formatto.rufoArgs` | Additional arguments to pass to `rufo`. | |
| `formatto.rufoPath` | Path to `rufo`. | `rufo` |
| `formatto.rufoPreferBundler` | Use `bundle exec` to run `rufo`. | `false` |
| `formatto.verifyRufo` | Verify that `rufo` is available before formatting. The check repeats until successful, then is cached for the session. | `true` |

Supported extensions: `.rb`, `.rbs`, `.rbi`, `.gemspec`, `.podspec`, `.erb`, `.rhtml`. Use [`formatto.additionalSupportedExtensions`](#configuration) to add extra extensions.

Rufo automatically loads `.rufo` [configuration files](https://github.com/ruby-formatter/rufo?tab=readme-ov-file#configuration) when present.

[↑ Back to top](#table-of-contents)

### Standard Ruby

| Setting | Description | Default |
|---------|-------------|---------|
| `formatto.standardrbArgs` | Additional arguments to pass to `standardrb`. | |
| `formatto.standardrbFormattingMode` | Controls how Formatto satisfies StandardRB's requirement to operate on real files. | `tmpFile` |
| `formatto.standardrbPath` | Path to `standardrb`. | `standardrb` |
| `formatto.standardrbPreferBundler` | Use `bundle exec` to run `standardrb`. | `false` |
| `formatto.verifyStandardrb` | Verify that `standardrb` is available before formatting. The check repeats until successful, then is cached for the session. | `true` |

Supported extensions: `.rb`, `.rbs`, `.rbi`, `.gemspec`, `.podspec`. Use [`formatto.additionalSupportedExtensions`](#configuration) to add extra extensions.

#### Save-to-disk behavior
*Standard Ruby* is different from *rubyfmt* and *rufo* as it can only format files on disk. Formatto provides the following modes to address this limitation (configurable via the `formatto.standardrbFormattingMode` setting):

* *tmpFile*: writes the editor contents to a temporary file, formats that file, and applies the resulting changes back to the editor. This is slower due to the additional file system operations, but avoids an unexpected save of the document and is therefore the default behavior. The extension attempts to clean-up these temporary files right away so they should not build up.
* *forceSave*: saves the document to disk before formatting it. This is not the default mode because it changes VS Code's standard formatter behavior in a significant way, but it may be preferred if you work on large files (to avoid additional I/O overhead).

Whenever the editor has no pending changes, `standardrb` runs directly against the file on disk and lets the editor detect the change.

[↑ Back to top](#table-of-contents)

## Commands

### Format Document

When Formatto is set as the **default formatter** for Ruby files, the built‑in **Format Document** command automatically uses it. This also applies to **Format on Save**.

If your project uses another formatter, or you simply want to try Formatto without switching defaults, you can run it on demand using the built‑in command **Format Document With…**. This lets you choose Formatto for a single formatting operation without modifying your workspace settings. This is the recommended way to test Formatto in projects that have not fully migrated yet.

[↑ Back to top](#table-of-contents)

### Format Pending Changes

Use the **Formatto: Format Pending Changes** command to format all modified Ruby files in Git repositories currently open in VS Code. This is a convenient option when you prefer not to enable **Format on Save**, or when you want to format multiple changed files at once. The command forces a refresh of the repository status known by VS Code, which could add significant overhead on some configurations. Check the [logs](#logs) for timing information.  

> This command is available **only** when at least one Git repository is open in the workspace.

[↑ Back to top](#table-of-contents)

### Format Selection

No Ruby formatter supports formatting arbitrary ranges of a file. Formatto implements **Format Selection** by sending the selected range to the formatter as if it were the full document, then applying a heuristic to map the result back. Ruby formatters normally operate only on complete, syntactically valid code; incomplete or broken selections are not currently expanded or repaired by the heuristic, so no change is applied in those cases (see the logs for details).

This feature is **experimental** and results may not match **Format Document**. 

> **DO NOT** report issues with selection‑formatting to the formatter projects, they most likely will reject any such issue.

If you understand the limitations, the feature can still be very useful. To enable it, use the `formatto.enableRangeFormatting` setting. Changes to this setting take effect only after a restart since it would be uncommon to change this setting.

[↑ Back to top](#table-of-contents)

## Logs

Formatto writes diagnostic information to the **Formatto** output channel.
You can adjust the log level using **Developer: Set Log Level** and selecting **Formatto**.
See [documentation](https://code.visualstudio.com/updates/v1_73#_setting-log-level-per-output-channel) for details.

[↑ Back to top](#table-of-contents)

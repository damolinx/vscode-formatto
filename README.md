# Formatto

Formatto is a flexible Ruby formatter for VS Code supporting [rubyfmt](https://github.com/fables-tales/rubyfmt), [rufo](https://github.com/ruby-formatter/rufo), and [standardrb](https://github.com/standardrb/standard). It is fully **multi‑root** aware, allowing each workspace folder to use its own formatter and configuration.

In simple terms, the extension enables the **Format Document** command in VS Code for any Ruby file, which makes **Format on Save** available. The extension provides a [**Format Selection**](#format-selection) implementation based on a heuristic, since not all Ruby formatters support range formatting; for this reason, it is disabled by default. This may be useful for template formats that embed Ruby. Additionally, [**Format Pending Changes**](#format-pending-changes) lets you format all Ruby files you have modified in your current Git repository.

## Table of Contents
- [Getting Started](#getting-started)
- [Configuration](#configuration)
  - [Rubyfmt](#rubyfmt)
  - [Rufo](#rufo)
  - [Standard Ruby](#standard-ruby)
- [Commands](#commands)
  - [Format Pending Changes](#format-pending-changes)
  - [Format Selection](#format-selection)
- [Logs](#logs)

## Getting Started

1. Make sure the formatter you selected is installed on your system.  
   - Installation guides: [rubyfmt](https://github.com/fables-tales/rubyfmt?tab=readme-ov-file#installation), [rufo](https://github.com/ruby-formatter/rufo?tab=readme-ov-file#installation), [standardrb](https://github.com/standardrb/standard#install)

2. Choose which formatter you want to use: **rubyfmt** (default), **rufo** or **standardrb**.  
   - If you prefer **rufo**, or **standardrb**, set the `"formatto.formatter"` from the appropriate settings JSON, or using the **Formatto: Formatter** option from the [Settings editor](https://code.visualstudio.com/docs/configure/settings#_settings-editor).
   - You can configure at User, Workspace and/or Workspace Folder settings level. Refer to [Settings Precedence](https://code.visualstudio.com/docs/configure/settings#_settings-precedence) documentation for further details.

3. Ensure that either:
  - executable is available on your system `PATH` (a restart may be required).  
  - the formatter location path is set using `"formatto.rubyfmtPath"`, `"formatto.rufoPath"` or `"formatto.standardrbPath"` settings.
  - you enable the appropriate `"formatto.rufoPreferBundler"` or `"formatto.standardrbPreferBundler"` setting to enable `bundle exec` use (`rubyfmt` does not support Bundler).
  
  > Whichever way you select, Formatto verifies that the selected formatter is reachable before executing it in the current session for the first time and it will prompt you for action if the given formatter cannot be found.

Once configured, use the built‑in **Format Document** command, or enable **Editor: Format on Save** to format automatically on save. See [Format Selection](#format-selection) for details on formatting a selection range.

### Choosing a formatter
This is really up to you, or the project you are working on but a few notes:
- **rubyfmt** provides deterministic, configuration‑free formatting. This is the default one used if you make no selection.
- **rufo** supports `.rufo` configuration and offers customizable formatting style.
- **standardrb** provides deterministic, opinionated formatting based on RuboCop's rule engine. Because it runs RuboCop rather than using a dedicated formatter, it is typically an order of magnitude slower than *rubyfmt* or *rufo*.

[↑ Back to top](#table-of-contents)

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `formatto.enableRangeFormatting` | Enables experimental support for **Format Selection**. | `false` |
| `formatto.formatter` | Formatter to use for formatting. | `rubyfmt` |
| `formatto.formatPendingChanges.includeStaged` | Include staged changes when running **Format Pending Changes**. | `true` |

For every formatter, there is a `formatto.«formatter»Path` setting whose value defaults to the executable name, e.g. `rubyfmt`, which is resolved from the system `PATH`. 
If the formatter is not reachable like that, use a path. The following replacement tokens are available to define this path:

* `${userHome}`: User home directory  
* `${workspaceFolder}`: Workspace folder containing the file being formatted

### Rubyfmt

| Setting | Description | Default |
|---------|-------------|---------|
| `formatto.rubyfmtArgs` | Additional arguments to pass to `rubyfmt`, e.g. `--header-opt-in`. | |
| `formatto.rubyfmtPath` | Path to `rubyfmt`. | `rubyfmt` | 
| `formatto.verifyRubyfmt` | Verify that `rubyfmt` is available before running the formatter. | `true` |

### Rufo

| Setting | Description | Default |
|---------|-------------|---------|
| `formatto.rufoArgs` | Additional arguments to pass to `rufo`. | |
| `formatto.rufoPath` | Path to `rufo`. | `rufo` |
| `formatto.rufoPreferBundler` | Use `bundle exec` to run `rufo`. | `false` |
| `formatto.verifyRufo` | Verify that `rufo` is available before running the formatter. | `true` |

Rufo automatically loads [`.rufo` configuration files](https://github.com/ruby-formatter/rufo?tab=readme-ov-file#configuration) when present.

[↑ Back to top](#table-of-contents)

### Standard Ruby

| Setting | Description | Default |
|---------|-------------|---------|
| `formatto.standardrbArgs` | Additional arguments to pass to `standardrb`. | |
| `formatto.standardrbFormattingMode` | Controls how Formatto satisfies StandardRB's requirement to operate on real files. | `tmpFile` |
| `formatto.standardrbPath` | Path to `standardrb`. | `standardrb` |
| `formatto.standardrbPreferBundler` | Use `bundle exec` to run `standardrb`. | `false` |
| `formatto.verifyStandardrb` | Verify that `standardrb` is available before running the formatter. | `true` |

*Standard Ruby* is different from rubyfmt and rufo as it can only format files on disk. Formatto provides the following modes to address this limitation (configurable via the `formatto.standardrbFormattingMode` setting):

* *tmpFile*: writes the editor contents to a temporary file, formats that file, and applies the resulting changes back to the editor. This is slower due to the additional file system operations, but avoids an unexpected save of the document and is therefore the default behavior. The extension attempts to clean-up these temporary files right away so they should not build up.
* *forceSave*: saves the document to disk before formatting it. This is not the default mode because it changes VS Code's standard formatter behavior in a significant way, but it may be preferred if you work on large files (to avoid additional I/O overhead).

Whenever the editor has no pending changes, `standardrb` runs directly against the file on disk and lets the editor detect the change.

[↑ Back to top](#table-of-contents)

## Commands

### Format Pending Changes

Use the **Formatto: Format Pending Changes** command to format all modified Ruby files in Git repositories currently open in VS Code. This is a convenient option when you prefer not to enable **Format on Save**, or when you want to format multiple changed files at once. The command forces a refresh of the repository status known by VS Code, which could add significant overhead on some configurations. Check the [logs](#logs) for timing information.  

> This command is available **only** when at least one Git repository is open in the workspace.

[↑ Back to top](#table-of-contents)

### Format Selection

No Ruby formatter supports formatting arbitrary ranges of a document/file. Formatto supports the **Format Selection** command by sending the selected range to the formatter as if it were the full document and then adjusting the result using a heuristic before applying back.

This feature is **experimental** and results may not match **Format Document**. In some cases, formatting might fail depending on the shape of the selection.

> **DO NOT** report issues with selection‑formatting to the formatter projects, they most likely will reject any such issue.

If you understand the limitations, the feature can still be very useful. To enable it, use the `formatto.enableRangeFormatting` setting. Changes to this setting take effect only after a restart since it would be uncommon to change this setting.

[↑ Back to top](#table-of-contents)

## Logs

Formatto writes diagnostic information to the **Formatto** output channel.
You can adjust the log level using **Developer: Set Log Level** and selecting **Formatto**.
See [documentation](https://code.visualstudio.com/updates/v1_73#_setting-log-level-per-output-channel) for details.

[↑ Back to top](#table-of-contents)

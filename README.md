# Formatto

Formatto is a flexible Ruby formatter for VS Code supporting [rubyfmt](https://github.com/fables-tales/rubyfmt), [rufo](https://github.com/ruby-formatter/rufo) and [standardrb](https://github.com/standardrb/standard). Formatto is fully **multi‑root** aware, formatters can be fully configured per workspace folder.

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

1. Choose which formatter you want to use: **rubyfmt** or **rufo**.  
   - By default, **rubyfmt** is used, so no selection is required. If you prefer **rufo**, set the `"formatto.formatter"` setting or use the **Formatto: Formatter** option in the [Settings editor](https://code.visualstudio.com/docs/configure/settings#_settings-editor).

2. Make sure the formatter you selected is installed on your system.  
   - Installation guides: [rubyfmt](https://github.com/fables-tales/rubyfmt?tab=readme-ov-file#installation), [rufo](https://github.com/ruby-formatter/rufo?tab=readme-ov-file#installation)

3. Ensure the formatter executable is available on your system `PATH` (a restart may be required).  
   Alternatively, set the `"formatto.rubyfmtPath"` or `"formatto.rufoPath"` setting, or use the **Formatto: Rubyfmt Path** or **Formatto: Rufo Path** options in the [Settings editor](https://code.visualstudio.com/docs/configure/settings#_settings-editor).  
   - Formatto verifies that the selected formatter is available before running it and will prompt you if it cannot be found.

Once configured, use the built‑in **Format Document** command, or enable **Editor: Format on Save** to format automatically on save. See [Format Selection](#format-selection) for details on formatting a selection range.

### Choosing a formatter
- **rubyfmt** provides deterministic, configuration‑free formatting.
  - It remains as the default purely for backward compatibility, since Formatto originally shipped with support for rubyfmt only.
- **rufo** supports `.rufo` configuration and offers customizable formatting style.
- **standardrb** also provides provides deterministic, configuration‑free formatting based on RuboCop rules but because of that, it is more than just a formatter.

[↑ Back to top](#table-of-contents)

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `formatto.enableRangeFormatting` | Enables experimental support for **Format Selection**. | `false` |
| `formatto.formatter` | Formatter to use for formatting. | `rubyfmt` |

The `formatto.«formatter»Path` values default to their executable name, e.g. `rubyfmt`, which is resolved from the system `PATH`. A path‑like value can be used instead, with the following tokens available:

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

Additionally, note that Rufo automatically loads [`.rufo` configuration files](https://github.com/ruby-formatter/rufo?tab=readme-ov-file#configuration) when present.

[↑ Back to top](#table-of-contents)

### Standard Ruby

| Setting | Description | Default |
|---------|-------------|---------|
| `formatto.standardrbArgs` | Additional arguments to pass to `standardrb`. | |
| `formatto.standardrbFormattingMode` | Controls how Formatto satisfies StandardRB's requirement to operate on real files. | `tmpFile` |
| `formatto.standardrbPath` | Path to `standardrb`. | `standardrb` |
| `formatto.standardrbPreferBundler` | Use `bundle exec` to run `standardrb`. | `false` |
| `formatto.verifyStandardrb` | Verify that `standardrb` is available before running the formatter. | `true` |

*Standard Ruby* is different from *rubyfmt* and *Rufo* as it can only format files on disk. Formatto provides the following modes to address this limitation (configurable via the `formatto.standardrbFormattingMode` setting):

* *tmpFile*: writes the editor contents to a temporary file, formats that file, and applies the resulting changes back to the editor. This is slower due to the additional filesystem operations, but avoids an unexpected save of the document and is therefore the default behavior.
* *forceSave*: saves the document to disk before formatting it. This is not the default mode because it changes standard formatter behavior, but it may be preferred in workflows where on‑disk state must always reflect the formatted result.

Whenever the editor has no pending changes, `standardrb` runs directly against the file on disk and lets the editor detect the change.

[↑ Back to top](#table-of-contents)

## Commands

### Format Pending Changes

Use the **Formatto: Format Pending Changes** command to format all modified Ruby files in your Git repositories. This is a convenient option when you prefer not to enable **Format on Save**, or when you want to format multiple changed files at once.

This command is available only when at least one Git repository is open in the workspace.

[↑ Back to top](#table-of-contents)

### Format Selection

Most Ruby formatters do not support formatting arbitrary ranges of a document. Formatto supports the  **Format Selection** command by sending the selected range to the formatter as if it were the full document and then adjusting the result using a heuristic.

This feature is **experimental**, and results may not match **Format Document** formatting. In some cases, formatting might fail depending on the shape of the selection.

> **DO NOT** report issues with selection‑formatting to the formatter projects.

If you understand the limitations, this feature can still be very useful. To enable it, use the `formatto.enableRangeFormatting` setting. Changes to this setting take effect only after a restart.

[↑ Back to top](#table-of-contents)

## Logs

Formatto writes diagnostic information to the **Formatto** output channel.
You can adjust the log level using **Developer: Set Log Level** and selecting **Formatto**.
See [documentation](https://code.visualstudio.com/updates/v1_73#_setting-log-level-per-output-channel) for details.

[↑ Back to top](#table-of-contents)

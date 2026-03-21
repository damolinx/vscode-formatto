# Formatto for VS Code

Formatto integrates [rubyfmt](https://github.com/fables-tales/rubyfmt) to provide Ruby code formatting.

## Table of Contents
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Commands](#commands)
  - [Format Pending Changes](#format-pending-changes)
  - [Format Selection](#format-selection)
- [Logs](#logs)

## Getting Started

1. Install `rubyfmt`. See the official [installation guide](https://github.com/fables-tales/rubyfmt?tab=readme-ov-file#installation).
2. Ensure `rubyfmt` is available on your system `PATH`.
   If it is not, configure the path using one of the following:
   - Set `"formatto.rubyfmtPath"` in your VS Code [settings.json](https://code.visualstudio.com/docs/configure/settings#_settings-json-file) file
   - Use **Formatto: Rubyfmt Path** in the VS Code [Settings UI](https://code.visualstudio.com/docs/configure/settings#_settings-editor)

Formatto will verify that `rubyfmt` is available before running the formatter and will prompt you if it cannot be found.

Once configured, Formatto will format Ruby files using the default **Format Document** command, or automatically on save if **Editor: Format on Save** is enabled. Check [Format Selection](#format-selection) section below for documentation on this specific command.

[↑ Back to top](#formatto-for-vs-code)

## Configuration

| Setting | Description |
|--------|-------------|
| `formatto.enableRangeFormatting` | Enables experimental support for **Format Selection**. |
| `formatto.rubyfmtArgs` | Additional arguments to pass to `rubyfmt`, e.g. `--prism`. |
| `formatto.rubyfmtPath` | Path to the `rubyfmt`. Defaults to `rubyfmt`. |
| `formatto.verifyRubyfmt` | Verifies that `rubyfmt` is available before running the formatter. |

The `formatto.rubyfmtPath` value defaults to `rubyfmt`, which is resolved from the system PATH. A full path or a tokenized path may also be used. The following tokens are available:

* `${userHome}`: User home directory
* `${workspaceFolder}`: Workspace folder containing the file being formatted

**Examples**

```jsonc
"formatto.rubyfmtPath": "${userHome}/bin/rubyfmt"
"formatto.rubyfmtPath": "${workspaceFolder}/tools/rubyfmt"
"formatto.rubyfmtPath": "rubyfmt"
```

[↑ Back to top](#formatto-for-vs-code)

## Commands

### Format Pending Changes

Use the **Formatto: Format Pending Changes** command to format all modified Ruby files in your Git repositories. This is a convenient option when you prefer not to enable **Format on Save**, or when you want to format multiple changed files at once.

This command is available only when at least one Git repository is open in the workspace.

[↑ Back to top](#formatto-for-vs-code)

### Format Selection

`rubyfmt` does not support formatting of a document range. Therefore, Formatto supports the **Format Selection** command by sending the document range and adjusting results back as necessary using a heuristic. This feature is **experimental** and results may not match **Format Document** formatting, or even expected ones, depending on the shape of the selection.

> **DO NOT** report issues with selection formatting to the `rubyfmt` project.

To enable this feature, use the `formatto.enableRangeFormatting` setting. A change to this setting takes effect only after a restart due to VS Code internals.

[↑ Back to top](#formatto-for-vs-code)

## Logs

Formatto writes diagnostic information to the **Formatto** output channel.
You can adjust the log level using **Developer: Set Log Level** and selecting **Formatto**.
See [documentation](https://code.visualstudio.com/updates/v1_73#_setting-log-level-per-output-channel) for details.

[↑ Back to top](#formatto-for-vs-code)
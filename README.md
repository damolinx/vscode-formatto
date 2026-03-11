# Formatto for VS Code

Formatto integrates [rubyfmt](https://github.com/fables-tales/rubyfmt) to provide Ruby code formatting.

## Table of Contents
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Format Selection](#format-selection)
- [Logs](#logs)

## Getting Started

1. Install `rubyfmt`. See the official [installation guide](https://github.com/fables-tales/rubyfmt?tab=readme-ov-file#installation).
2. Ensure `rubyfmt` is available on your system `PATH`.  
   If it is not, configure the path using one of the following:
   - Set `"formatto.rubyfmtPath"` in your VS Code [settings JSON](https://code.visualstudio.com/docs/configure/settings#_settings-json-file)
   - Use **Formatto: Rubyfmt Path** in the VS Code [Settings UI](https://code.visualstudio.com/docs/configure/settings#_settings-editor)

Once configured, Formatto will format Ruby files using **Format Document**, or automatically on save if **Editor: Format on Save** is enabled.

## Configuration

| Setting | Description |
|--------|-------------|
| `formatto.rubyfmtPath` | Path to the `rubyfmt` executable. Defaults to `rubyfmt`. |
| `formatto.enableRangeFormatting` | Enables experimental support for **Format Selection**. |

The `formatto.rubyfmtPath` value defaults to `rubyfmt`, which is resolved from the system PATH. A full path or a tokenized path may also be used. The following tokens are available:

* `${userHome}`: User home directory  
* `${workspaceFolder}`: Workspace folder containing the file being formatted  

**Examples**

```jsonc
"formatto.rubyfmtPath": "${userHome}/bin/rubyfmt"
"formatto.rubyfmtPath": "${workspaceFolder}/bin/rubyfmt"
"formatto.rubyfmtPath": "rubyfmt" // resolved from PATH
```

## Format Selection

`rubyfmt` does not support range formatting. Formatto supports the **Format Selection** command using custom heuristic logic. This feature is **experimental** and results may not match **Format Document** formatting.

> DO NOT report issues with selection formatting to the `rubyfmt` project.

To enable, use the `formatto.enableRangeFormatting` setting. Changes take effect only after a restart.

## Logs

Formatto writes diagnostic information to the **Formatto** output channel.  
You can adjust the log level using **Developer: Set Log Level** and selecting **Formatto**.  
See [documentation](https://code.visualstudio.com/updates/v1_73#_setting-log-level-per-output-channel) for details.

[↑ Back to top](#formatto-for-vs-code)
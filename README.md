# Formatto for VS Code

Formatto integrates [rubyfmt](https://github.com/fables-tales/rubyfmt) to provide Ruby code formatting.

## Table of Contents
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Logs](#logs)

## Getting Started

1. Install `rubyfmt`. See the official [installation guide](https://github.com/fables-tales/rubyfmt?tab=readme-ov-file#installation).
2. Ensure `rubyfmt` is available on your system `PATH`.  
   If it is not, configure the path using one of the following:
   - Set `"formatto.rubyfmtPath"` in your VS Code [settings JSON](https://code.visualstudio.com/docs/configure/settings#_settings-json-file)
   - Use **Formatto: Rubyfmt Path** in the VS Code [Settings UI](https://code.visualstudio.com/docs/configure/settings#_settings-editor)

Once configured, Formatto will format Ruby files using the standard **Format Document** or **Format Selection** commands, or will automatically format on save if **Editor: Format on Save** is enabled.

## Configuration

| Setting | Description |
|--------|-------------|
| `formatto.rubyfmtPath` | Absolute or relative path to the `rubyfmt` executable. Defaults to `rubyfmt` (resolved from `PATH`). |

## Logs

Formatto writes diagnostic information to the **Formatto** output channel.  
You can adjust the log level using **Developer: Set Log Level** and selecting **Formatto**.  
See the VS Code documentation for details:  
https://code.visualstudio.com/updates/v1_73#_setting-log-level-per-output-channel

[↑ Back to top](#formatto-for-vs-code)
# Changelog

## 0.2.1
- Improvements to **Format Selection**.

## 0.2.0
- Add `formatto.rubyfmtArgs` setting to pass additional arguments to `rubyfmt`.
- `rubyfmt` verification UX updates:
  - **Ignore** option renamed to **Don't ask again**.
  - `formatto.verifyRubyfmt` setting is always updated in **User Settings** (vs Workspace or Workspace Folder).
- Update link to `rubyfmt` installation (*Installation* section).
- Availability check now logs the `rubyfmt --version` output.

## 0.1.4
- Update link to `rubyfmt` installation (current repo).

## 0.1.3
- Add verification and UX around `rubyfmt` availability before running the formatter.

## 0.1.2
- Disable **Format Selection** by default since `rubyfmt` does not support range formatting.
  - Add `formatto.enableRangeFormatting` setting to opt in to an experimental heuristic.
- Add support for `${userHome}` and `${workspaceFolder}` tokens in `formatto.rubyfmtPath`.

## 0.1.1
- Add icon.

## 0.1.0
- Initial version. Runs **rubyfmt** using `formatto.rubyfmtPath` setting value, which defaults to `rubyfmt`.
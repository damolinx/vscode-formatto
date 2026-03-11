# Changelog

## 0.1.2
- Disable **Format Selection** by default since `rubyfmt` does not support range formatting.
  - Add `formatto.enableRangeFormatting` setting to opt in to an experimental heuristic.
- Add support for `${userHome}` and `${workspaceFolder}` tokens in `formatto.rubyfmtPath`.

## 0.1.1
- Add icon. 

## 0.1.0
- Initial version. Runs **rubyfmt** using `formatto.rubyfmtPath` setting value, which defaults to `rubyfmt`.
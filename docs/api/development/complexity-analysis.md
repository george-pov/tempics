# C# Complexity Analysis

Use [Arborist CLI](https://github.com/StrangeDaysTech/arborist-cli/blob/v0.2.1/README.md)
to measure cognitive and cyclomatic complexity in `src/api/`. It reads the API
source and tests without building the .NET solution. Run these PowerShell
commands from the repository root.

## Quick Scan

Install `arborist-cli` 0.2.1 once. On Windows, download the
[prebuilt x64 ZIP](https://github.com/StrangeDaysTech/arborist-cli/releases/tag/v0.2.1),
extract it, and put the folder containing `arborist.exe` on your PATH.

```powershell
arborist src/api --gitignore --sort cognitive --top 10
arborist src/api --gitignore --sort cyclomatic --top 10
```

`src/api/` currently contains only C# source files. `--gitignore` keeps ignored
`bin` and `obj` output out of the scan. The first command shows the ten highest
cognitive scores; the second shows the ten highest cyclomatic scores.

## Save A Report

Save all method results as CSV outside the repository:

```powershell
arborist src/api --gitignore --format csv |
    Set-Content -Encoding utf8 "$env:TEMP\tempics-complexity-before.csv"
```

The CSV includes each method's file, line, cognitive score, cyclomatic score,
and source lines of code. For a shareable summary, record the revision
(`git rev-parse --short HEAD`), worktree changes (`git status --short`), CLI
version (`arborist --version`), scan command, highest scoring methods, and why
they need review. See the
[metric definitions](https://github.com/StrangeDaysTech/arborist-metrics#metrics)
before interpreting scores. A lower score alone does not prove a safer or
clearer implementation.

After a refactor, repeat the CSV command with a different filename, such as
`tempics-complexity-after.csv`. Compare the same methods using the same CLI
version and scan options, then run the relevant
[API tests](build-and-test.md). Note before and after scores, test results, and
any skipped checks in the summary.

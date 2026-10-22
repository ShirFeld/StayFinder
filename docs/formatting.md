# Prettier

Prettier is installed in the root development dependencies with an exact version. `npm ci` installs the same version for developers and GitHub Actions. The VS Code Prettier extension uses that local installation in a trusted workspace.

Run commands from the repository root:

```powershell
npm run format
npm run format:check
npm run check
```

`format` rewrites supported source, configuration and documentation files. `format:check` checks them without modifying anything and fails if formatting differs. `check` runs the formatting check, ESLint, TypeScript checks and the client build. The GitHub `quality` job runs `check`; test jobs remain independent.

The shared `.prettierrc.json` config uses two spaces, double quotes, semicolons, trailing commas, an 80-character target line width and LF line endings. `.gitattributes` keeps text line endings consistent across Windows and CI. The line width guides wrapping; Prettier can leave long strings and other constructs wider than that target.

`.prettierignore` excludes generated builds, reports, dependencies, local data, credentials, the npm-generated lockfile and the historical conversation checkpoint. Prettier also respects the root `.gitignore`. SQL formatting is not configured; no SQL plugin is installed.

The workspace recommends **Prettier - Code formatter** (`esbenp.prettier-vscode`) and sets it as the default formatter with format-on-save enabled. Install or enable the extension in VS Code; its output uses the shared project settings. `prettier.requireConfig` limits formatting to files with a configuration.

ESLint checks code correctness. Its final `eslint-config-prettier` configuration disables conflicting formatting rules. Prettier runs directly through its own commands, rather than as an ESLint rule.

After editing, use `npm run format`, then `npm run check`. CI only checks formatting and does not rewrite or commit files.

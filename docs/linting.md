# ESLint

Use Node.js 22.13 or newer in the 22 LTS line; `.nvmrc` pins the tested version for local version managers and GitHub Actions. The project uses ESLint 10 with a TypeScript flat configuration loaded through `jiti`.

Run from the repository root:

```powershell
npm run lint
npm run lint:fix
npm run check
```

`lint` checks all TypeScript and TSX files and fails on errors or warnings. `lint:fix` applies the fixes ESLint can perform automatically; some issues require a manual change. `check` checks Prettier formatting, runs lint, then TypeScript checks and the client build. TypeScript checking remains separate because ESLint does not replace the compiler.

The root [eslint.config.ts](../eslint.config.ts) contains the shared rules and file-specific groups. The root `tsconfig.json` includes that configuration file so the editor and `npm run typecheck:config` check it with the project's TypeScript options. This check is also part of `npm run typecheck` and the CI `quality` job.

The rule groups are:

| Files                                                                               | Checks                                                                                                          |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| All `.ts` and `.tsx` sources                                                        | Recommended JavaScript/TypeScript rules, unused variables, explicit type imports.                               |
| Client, server, automation and CI scripts included by workspace TypeScript projects | Unhandled promises, awaiting non-promises and async callbacks in incompatible positions.                        |
| `client/src/**/*.tsx`                                                               | JSX, list keys, nested component definitions, hook usage and effect dependencies.                               |
| `automation/tests/**/*.spec.ts`                                                     | Playwright recommended rules, including missing assertions, focused/skipped tests and unreliable test patterns. |

Node and browser globals are scoped to their respective files. Generated builds, dependencies, reports, test results and local database files are ignored. `eslint-config-prettier` is applied last to disable rules that conflict with Prettier. ESLint focuses on code correctness; [Prettier handles formatting](formatting.md).

Unused callback arguments and variables can be named with an initial underscore when they must be retained. Ambient namespace declarations are allowed for Express type augmentation. Node's `test()` registration promises are owned by the test runner; other promise checks still apply inside server tests. React event attributes accept async handlers. Inline `import("...").Type` annotations remain allowed.

Any local rule suppression must state its reason. Unused suppression comments fail lint. Existing narrow exceptions cover raw JSON bodies validated by HTTP test assertions and repeated image URLs in the read-only gallery.

VS Code recommends **ESLint** (`dbaeumer.vscode-eslint`) through `.vscode/extensions.json`. Install the recommended extension to see diagnostics in the editor. Workspace settings enable TypeScript/TSX validation and automatic fixes on explicit saves.

GitHub's `quality` job runs `npm run check` for the workflow's existing push, pull request and manual triggers. Its check name remains `quality`; existing required-check rules do not need a new ESLint check name. Test jobs continue to run independently when lint fails. See [CI configuration](ci.md).

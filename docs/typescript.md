# TypeScript

The client, server, automation tests, development scripts and configuration files use TypeScript. React components use `.tsx`; other source files use `.ts`.

Run these commands from the repository root:

```powershell
npm run typecheck
npm run build
npm test
npm run test:automation
```

`typecheck` checks all three workspaces without generating JavaScript. `build` runs those checks before bundling the client. CI runs the same build and regression suites.

`tsconfig.base.json` enables strict checks and shared ES2022/module settings. Each workspace has its own `tsconfig.json`: the client includes browser and React types; the server includes Node types; automation includes both browser and Node types.

`shared/types.ts` defines API models used by the UI and server. `server/src/types.ts` defines SQLite row types, session/request extensions and the payment provider interface. SQL query results declare their row shape at the query boundary. Runtime input validation remains in the server; TypeScript types do not validate external JSON or SQL results.

The server and command-line scripts run with `node --import tsx`, including watch mode and Node's test runner. `tsx` is a server runtime dependency. Vite handles frontend TypeScript; Playwright handles test TypeScript. Existing `npm run dev`, `npm start`, database and QA commands remain available. SQL migrations and database files retain their formats.

Server integration tests intentionally treat raw HTTP JSON as dynamic data at the response boundary; scenario assertions verify the response. Playwright page objects and fixtures have explicit types.

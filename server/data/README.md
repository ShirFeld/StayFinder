# Local data directory

This directory contains local runtime data and private development artifacts. Only this README is tracked in Git. Fresh clones create runtime files when the corresponding commands run; archived files are not required.

| Path | Purpose |
| --- | --- |
| `stayfinder.sqlite` | Main development database: users, properties, bookings, payments and sessions. |
| `stayfinder.sqlite-wal`, `stayfinder.sqlite-shm` | SQLite companion files for pending writes and coordination. SQLite manages them; do not delete or move them while the API is running. |
| `qa/` | Isolated QA database, managed by the `qa:*` npm commands. |
| `stripe/stripe-cli.toml` | Private Stripe CLI configuration used by `npm run payments:listen`. |
| `stripe/stripe-sandbox-access.md` | Private sandbox setup/access information. Do not share or commit it. |
| `logs/` | Historical Stripe setup and webhook listener logs. These are not required to run the app and may contain sensitive information. |
| `archive/development-scripts/` | One-off scripts used to modify code during development. These are historical artifacts, not application scripts or automated tests. Do not run them: they may overwrite current source files and their old paths are not maintained. |

## Commands and source code

- Maintained startup and database commands live in `server/scripts/`, outside this directory.
- Database migrations and seed code live in `server/src/`; they are versioned source code.
- Automated server tests live in `server/test/`.
- Use `npm run qa:db:reset` to reset only the QA database. The normal database has a separate explicit reset command.

The main database stays at its existing path to preserve local configuration and avoid moving a database used by a running server. The whole directory contains local data; never commit its databases, private configuration, logs or archived scripts.

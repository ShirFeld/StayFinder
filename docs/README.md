# Documentation guide

| Document | What to use it for |
| --- | --- |
| [Automation guide](../automation/README.md) | Playwright setup, commands, fixtures, reports and isolation. |
| [Test strategy](../automation/test-strategy.md) | Coverage layers, interview walkthrough and limitations. |
| [Project README](../README.md) | Installation, startup commands, demo accounts and limitations. |
| [Architecture](architecture.md) | Project structure, responsibilities and request flows. |
| [Requirements](requirements.md) | Features and business rules to derive test cases from. |
| [Stabilization contract](stabilization.md) | Expected behavior for checkout recovery, refunds, navigation and accessibility. |
| [QA environment](qa-environment.md) | Separate ports, database, credentials and safe QA reset commands. |
| [Payments](payments.md) | Stripe sandbox setup, payment lifecycle, test cards and refunds. |
| [Verification](verification.md) | Historical verification results and their limitations. |
| [SQL practice](sql-practice.sql) | Read-only example queries for the practice database. |
| [Image credits](image-credits.md) | Sources of bundled sample images. |
| [Conversation checkpoint](conversation-checkpoint.md) | Historical development context; current behavior is described by the guides above. |

The API contract is maintained in `server/src/openapi.ts`. With the normal API running, open <http://localhost:3001/api/docs> for Swagger UI or <http://localhost:3001/api/openapi.json> for the JSON specification. The QA API exposes the same routes on port 3002.

Server integration tests live in `server/test/`. The Playwright project now lives in `automation/` with independent disposable databases. One-off development scripts, historical browser profiles and temporary verification output were removed during repository cleanup; verification reports remain as a historical record, not as runnable browser tests.

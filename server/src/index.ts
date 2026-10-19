import { createApp } from "./app.ts";
import { config } from "./config.ts";
const app = createApp();
const reconciliation = setInterval(
  () => app.locals.payments.reconcile().catch(() => {}),
  15000,
);
reconciliation.unref();
app.locals.payments.reconcile().catch(() => {});
const server = app.listen(config.port, "127.0.0.1", () =>
  console.log(
    "StayFinder API: http://localhost:" +
      config.port +
      "\nSwagger: http://localhost:" +
      config.port +
      "/api/docs",
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    clearInterval(reconciliation);
    server.close(() => process.exit(0));
  });

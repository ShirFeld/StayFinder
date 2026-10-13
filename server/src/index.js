import { createApp } from "./app.js";
import { config } from "./config.js";
const server = createApp().listen(config.port, "127.0.0.1", () =>
  console.log(
    "StayFinder API: http://localhost:" +
      config.port +
      "\nSwagger: http://localhost:" +
      config.port +
      "/api/docs",
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close(() => process.exit(0)));

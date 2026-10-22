import bcrypt from "bcryptjs";
import express from "express";
import { rateLimit } from "express-rate-limit";
import session from "express-session";
import helmet from "helmet";
import { existsSync } from "node:fs";
import path from "node:path";
import swaggerUi from "swagger-ui-express";
import { config, serverRoot, today } from "./config.ts";
import { db, migrate } from "./database.ts";
import { openapi } from "./openapi.ts";
import { createPayments } from "./payments.ts";
import { SQLiteSessionStore } from "./session-store.ts";
import type { BookingRow, CheckoutRow, PropertyRow, UserRow } from "./types.ts";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const fail: import("./types.ts").Fail = (status, code, message) => {
  throw new ApiError(status, code, message);
};
const asyncRoute =
  (
    fn: (
      req: import("express").Request,
      res: import("express").Response,
      next: import("express").NextFunction,
    ) => void | Promise<unknown>,
  ): import("express").RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
const integer = (v: unknown, name: string, min = 1, max = 1000000) => {
  if (
    (typeof v !== "number" && typeof v !== "string") ||
    v === "" ||
    !Number.isSafeInteger(Number(v)) ||
    Number(v) < min ||
    Number(v) > max
  )
    fail(
      400,
      "VALIDATION_ERROR",
      name + " must be an integer between " + min + " and " + max + ".",
    );
  return Number(v);
};
const text = (v: unknown, name: string, max = 200) => {
  if (typeof v !== "string" || !v.trim() || v.trim().length > max)
    fail(
      400,
      "VALIDATION_ERROR",
      name + " is required and must be at most " + max + " characters.",
    );
  return v.trim();
};
export const amenities = [
  "WiFi",
  "Kitchen",
  "Pool",
  "Parking",
  "Air conditioning",
  "Pet friendly",
];
function dates(input: { checkIn?: unknown; checkOut?: unknown }) {
  const checkIn = input.checkIn as string,
    checkOut = input.checkOut as string;
  for (const date of [checkIn, checkOut])
    if (
      typeof date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date
    )
      fail(400, "INVALID_DATES", "Use valid dates in YYYY-MM-DD format.");
  if (checkIn < today())
    fail(400, "PAST_DATE", "Check-in cannot be in the past.");
  if (checkOut <= checkIn)
    fail(400, "INVALID_DATES", "Check-out must be after check-in.");
  const nights = (Date.parse(checkOut) - Date.parse(checkIn)) / 86400000;
  if (nights > 365)
    fail(400, "INVALID_DATES", "A stay cannot exceed 365 nights.");
  return { checkIn, checkOut, nights };
}
const serializeProperty = (p: PropertyRow) => ({
  ...p,
  active: !!p.active,
  amenities: JSON.parse(p.amenities),
  images: JSON.parse(p.images),
  currency: "USD",
});
const publicUser = (u: UserRow) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  active: !!u.active,
});
function property(id: unknown, includeInactive = false) {
  const row = db
    .prepare<unknown[], PropertyRow>("SELECT * FROM properties WHERE id=?")
    .get(integer(id, "Property ID"))!;
  if (!row || (!row.active && !includeInactive))
    fail(404, "NOT_FOUND", "Accommodation not found.");
  return row;
}
function available(id: number, checkIn: string, checkOut: string) {
  return (
    !db
      .prepare<unknown[], BookingRow>(
        "SELECT id FROM bookings WHERE property_id=? AND status='confirmed' AND check_in<? AND check_out>?",
      )
      .get(id, checkOut, checkIn)! &&
    !db
      .prepare<unknown[], CheckoutRow>(
        "SELECT id FROM checkouts WHERE property_id=? AND status IN ('creating','open') AND expires_at>unixepoch() AND check_in<? AND check_out>?",
      )
      .get(id, checkOut, checkIn)!
  );
}
function quote(input: import("../../shared/types.ts").BookingInput) {
  const p = property(input.propertyId);
  const range = dates(input);
  const guests = integer(input.guests, "Guests", 1, p.capacity);
  if (!available(p.id, range.checkIn, range.checkOut))
    fail(
      409,
      "BOOKING_CONFLICT",
      "This accommodation is unavailable for these dates.",
    );
  return {
    propertyId: p.id,
    ...range,
    guests,
    nightlyPriceCents: p.price_cents,
    totalCents: range.nights * p.price_cents,
    currency: "USD",
  };
}
function propertyInput(body: Record<string, unknown>) {
  const name = text(body.name, "Name", 120),
    destination = text(body.destination, "Destination", 120),
    description = text(body.description, "Description", 4000);
  const priceCents = integer(body.priceCents, "Price in cents", 1, 100000000),
    capacity = integer(body.capacity, "Capacity", 1, 50);
  if (
    !Array.isArray(body.amenities) ||
    body.amenities.some((a) => !amenities.includes(a))
  )
    fail(400, "VALIDATION_ERROR", "Choose supported amenities.");
  if (
    !Array.isArray(body.images) ||
    body.images.length < 1 ||
    body.images.length > 8 ||
    body.images.some((url) => {
      try {
        return new URL(url).protocol !== "https:";
      } catch {
        return true;
      }
    })
  )
    fail(400, "VALIDATION_ERROR", "Provide 1 to 8 HTTPS image URLs.");
  const latitude = body.latitude,
    longitude = body.longitude;
  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 90 ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    Math.abs(longitude) > 180
  )
    fail(
      400,
      "VALIDATION_ERROR",
      "Valid numeric latitude and longitude are required.",
    );
  if (body.active !== undefined && typeof body.active !== "boolean")
    fail(400, "VALIDATION_ERROR", "Active must be a boolean.");
  return [
    name,
    destination,
    description,
    priceCents,
    capacity,
    JSON.stringify([...new Set(body.amenities as string[])]),
    JSON.stringify(body.images),
    latitude,
    longitude,
    body.active === false ? 0 : 1,
  ];
}
const bookingSelect =
  "SELECT b.*,p.name property_name,p.destination,p.images,u.name customer_name,u.email customer_email FROM bookings b JOIN properties p ON p.id=b.property_id JOIN users u ON u.id=b.user_id";
const bookingOut = (
  b: BookingRow,
): import("../../shared/types.ts").Booking => ({
  ...b,
  images: JSON.parse(b.images),
});
export function createApp({
  stripe,
}: { stripe?: import("./types.ts").PaymentProvider } = {}) {
  migrate();
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: false }));
  const payments = createPayments({
    stripe,
    quote,
    integer,
    fail,
    bookingSelect,
    bookingOut,
  });
  app.locals.payments = payments;
  // Signature verification requires the exact bytes, before JSON parsing and sessions.
  app.post(
    "/api/payments/webhook",
    express.raw({ type: "application/json", limit: "100kb" }),
    asyncRoute(payments.webhook),
  );
  app.use(express.json({ limit: "100kb" }));
  const allowedOrigins = new Set([config.origin]);
  const configuredOrigin = new URL(config.origin);
  if (["localhost", "127.0.0.1"].includes(configuredOrigin.hostname)) {
    for (const hostname of ["localhost", "127.0.0.1"]) {
      const alias = new URL(config.origin);
      alias.hostname = hostname;
      allowedOrigins.add(alias.origin);
    }
  }
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.get("origin");
      if (
        origin &&
        !allowedOrigins.has(origin) &&
        !(origin === req.protocol + "://" + req.get("host"))
      )
        return next(
          new ApiError(
            403,
            "ORIGIN_REJECTED",
            "Request origin is not allowed.",
          ),
        );
    }
    next();
  });
  app.use(
    session({
      name: config.sessionName,
      secret: config.secret,
      store: new SQLiteSessionStore(),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: config.production,
        maxAge: 86400000,
      },
    }),
  );
  app.use((req, res, next) => {
    if (req.session.userId) {
      const u = db
        .prepare<unknown[], UserRow>(
          "SELECT * FROM users WHERE id=? AND active=1",
        )
        .get(req.session.userId)!;
      if (u) req.user = u;
    }
    next();
  });
  const auth: import("express").RequestHandler = (req, res, next) =>
    req.user
      ? next()
      : next(new ApiError(401, "UNAUTHENTICATED", "Please sign in."));
  const admin: import("express").RequestHandler = (req, res, next) =>
    req.user?.role === "admin"
      ? next()
      : next(
          new ApiError(
            req.user ? 403 : 401,
            req.user ? "FORBIDDEN" : "UNAUTHENTICATED",
            "Administrator access is required.",
          ),
        );
  app.get("/api/health", (req, res) =>
    res.json({
      status: "ok",
      today: today(),
      timezone: config.timezone,
      currency: "USD",
    }),
  );
  app.get("/api/auth/me", (req, res) =>
    res.json({ user: req.user ? publicUser(req.user) : null }),
  );
  app.post(
    "/api/auth/login",
    rateLimit({
      windowMs: 15 * 60000,
      limit: 100,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      handler: (req, res) =>
        res.status(429).json({
          error: {
            code: "RATE_LIMITED",
            message: "Too many login attempts. Try again later.",
          },
        }),
    }),
    asyncRoute(async (req, res) => {
      const email = text(req.body.email, "Email").toLowerCase(),
        password = text(req.body.password, "Password", 200);
      const user = db
        .prepare<unknown[], UserRow>(
          "SELECT * FROM users WHERE email=? AND active=1",
        )
        .get(email)!;
      if (!user || !(await bcrypt.compare(password, user.password_hash)))
        fail(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
      await new Promise<void>((resolve, reject) =>
        req.session.regenerate((e) => (e ? reject(e) : resolve())),
      );
      req.session.userId = user.id;
      await new Promise<void>((resolve, reject) =>
        req.session.save((e) => (e ? reject(e) : resolve())),
      );
      res.json({ user: publicUser(user) });
    }),
  );
  app.post(
    "/api/auth/logout",
    asyncRoute(async (req, res) => {
      await new Promise<void>((resolve, reject) =>
        req.session.destroy((e) => (e ? reject(e) : resolve())),
      );
      res.clearCookie(config.sessionName, {
        httpOnly: true,
        sameSite: "lax",
        secure: config.production,
      });
      res.status(204).end();
    }),
  );
  app.get("/api/destinations", (req, res) =>
    res.json({
      items: db
        .prepare<unknown[], { n: number }>(
          "SELECT destination,count(*) count,latitude,longitude FROM properties WHERE active=1 GROUP BY destination ORDER BY destination",
        )
        .all(),
    }),
  );
  app.get("/api/properties", (req, res, next) => {
    try {
      const q = req.query,
        clauses = ["p.active=1"],
        args: unknown[] = [];
      if (q.destination) {
        clauses.push("p.destination LIKE ?");
        args.push("%" + text(q.destination, "Destination", 120) + "%");
      }
      if (q.guests !== undefined) {
        clauses.push("p.capacity>=?");
        args.push(integer(q.guests, "Guests", 1, 50));
      }
      for (const [field, op] of [
        ["minPrice", ">="],
        ["maxPrice", "<="],
      ])
        if (q[field] !== undefined) {
          clauses.push("p.price_cents" + op + "?");
          args.push(integer(q[field], field, 0, 100000000));
        }
      if (
        q.minPrice !== undefined &&
        q.maxPrice !== undefined &&
        Number(q.minPrice) > Number(q.maxPrice)
      )
        fail(
          400,
          "VALIDATION_ERROR",
          "Minimum price cannot exceed maximum price.",
        );
      if (q.amenities) {
        for (const amenity of text(q.amenities, "Amenities").split(",")) {
          if (!amenities.includes(amenity))
            fail(400, "VALIDATION_ERROR", "Unsupported amenity.");
          clauses.push(
            "EXISTS(SELECT 1 FROM json_each(p.amenities) WHERE value=?)",
          );
          args.push(amenity);
        }
      }
      if (q.checkIn || q.checkOut) {
        const range = dates(q);
        clauses.push(
          "NOT EXISTS(SELECT 1 FROM bookings b WHERE b.property_id=p.id AND b.status='confirmed' AND b.check_in<? AND b.check_out>?)",
        );
        args.push(range.checkOut, range.checkIn);
        clauses.push(
          "NOT EXISTS(SELECT 1 FROM checkouts c WHERE c.property_id=p.id AND c.status IN ('creating','open') AND c.expires_at>unixepoch() AND c.check_in<? AND c.check_out>?)",
        );
        args.push(range.checkOut, range.checkIn);
      }
      const sort = text(q.sort || "recommended", "Sort"),
        sorts: Record<string, string> = {
          recommended: "p.id",
          price_asc: "p.price_cents,p.id",
          price_desc: "p.price_cents DESC,p.id",
          name: "p.name,p.id",
        };
      if (!sorts[sort])
        fail(400, "VALIDATION_ERROR", "Unsupported sort order.");
      const page = integer(q.page ?? 1, "Page", 1, 100000),
        pageSize = integer(q.pageSize ?? 6, "Page size", 1, 50);
      const where = clauses.join(" AND "),
        total = db
          .prepare<unknown[], { n: number }>(
            "SELECT count(*) n FROM properties p WHERE " + where,
          )
          .get(...args)!.n;
      const items = db
        .prepare<unknown[], PropertyRow>(
          "SELECT p.* FROM properties p WHERE " +
            where +
            " ORDER BY " +
            sorts[sort] +
            " LIMIT ? OFFSET ?",
        )
        .all(...args, pageSize, (page - 1) * pageSize)
        .map(serializeProperty);
      res.json({
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      });
    } catch (caught) {
      const e = caught as Error & { code?: string; type?: string };
      next(e);
    }
  });
  app.get("/api/properties/:id", (req, res) =>
    res.json(serializeProperty(property(req.params.id))),
  );
  app.get("/api/properties/:id/availability", (req, res) =>
    res.json({
      available: true,
      ...quote({
        ...req.query,
        propertyId: req.params.id,
      } as import("../../shared/types.ts").BookingInput),
    }),
  );
  app.get("/api/bookings", auth, (req, res) =>
    res.json({
      items: db
        .prepare<unknown[], BookingRow>(
          bookingSelect + " WHERE b.user_id=? ORDER BY b.id DESC",
        )
        .all(req.user.id)
        .map(bookingOut),
    }),
  );
  app.post(
    "/api/checkouts/:id/refund",
    auth,
    asyncRoute(async (req, res) =>
      res.json(await payments.retryRefund(req.params.id, req.user.id)),
    ),
  );
  // Direct booking is intentionally disabled: payment cannot be bypassed.
  app.post("/api/bookings", auth, (_req, _res) =>
    fail(
      409,
      "PAYMENT_REQUIRED",
      "Continue to checkout to pay before confirming your booking.",
    ),
  );
  app.post(
    "/api/checkouts",
    auth,
    asyncRoute(async (req, res) =>
      res
        .status(201)
        .json(
          await payments.start(
            req.user,
            req.body,
            req.get("Idempotency-Key"),
            req.get("origin"),
          ),
        ),
    ),
  );
  app.get("/api/checkouts", auth, (req, res) =>
    res.json({ items: payments.list(req.user.id) }),
  );
  app.get("/api/checkouts/:id", auth, (req, res) =>
    res.json(payments.out(payments.owner(req.params.id, req.user.id))),
  );
  app.post(
    "/api/checkouts/:id/sync",
    auth,
    asyncRoute(async (req, res) => {
      payments.owner(req.params.id, req.user.id);
      res.json(await payments.synchronize(req.params.id));
    }),
  );
  app.post(
    "/api/checkouts/:id/cancel",
    auth,
    asyncRoute(async (req, res) =>
      res.json(await payments.cancelCheckout(req.params.id, req.user.id)),
    ),
  );
  app.post(
    "/api/bookings/:id/cancel",
    auth,
    asyncRoute(async (req, res) =>
      res.json(await payments.cancelBooking(req.params.id, req.user.id)),
    ),
  );
  app.get("/api/admin/properties", admin, (req, res) =>
    res.json({
      items: db
        .prepare<unknown[], PropertyRow>("SELECT * FROM properties ORDER BY id")
        .all()
        .map(serializeProperty),
    }),
  );
  app.post("/api/admin/properties", admin, (req, res) => {
    const values = propertyInput(req.body);
    const r = db
      .prepare(
        "INSERT INTO properties(name,destination,description,price_cents,capacity,amenities,images,latitude,longitude,active) VALUES(?,?,?,?,?,?,?,?,?,?)",
      )
      .run(...values);
    res.status(201).json(serializeProperty(property(r.lastInsertRowid, true)));
  });
  app.put("/api/admin/properties/:id", admin, (req, res) => {
    const p = property(req.params.id, true),
      values = propertyInput(req.body);
    db.prepare(
      "UPDATE properties SET name=?,destination=?,description=?,price_cents=?,capacity=?,amenities=?,images=?,latitude=?,longitude=?,active=? WHERE id=?",
    ).run(...values, p.id);
    res.json(serializeProperty(property(p.id, true)));
  });
  app.get("/api/admin/users", admin, (req, res) =>
    res.json({
      items: db
        .prepare<unknown[], UserRow>("SELECT * FROM users ORDER BY id")
        .all()
        .map(publicUser),
    }),
  );
  app.post(
    "/api/admin/users",
    admin,
    asyncRoute(async (req, res) => {
      const name = text(req.body.name, "Name", 100),
        email = text(req.body.email, "Email").toLowerCase(),
        password = text(req.body.password, "Password", 200),
        role = req.body.role;
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        password.length < 10 ||
        !["admin", "customer"].includes(role)
      )
        fail(
          400,
          "VALIDATION_ERROR",
          "Use a valid email, a password of at least 10 characters, and an admin or customer role.",
        );
      const hash = await bcrypt.hash(password, 12);
      const r = db
        .prepare(
          "INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)",
        )
        .run(name, email, hash, role);
      res
        .status(201)
        .json(
          publicUser(
            db
              .prepare<unknown[], UserRow>("SELECT * FROM users WHERE id=?")
              .get(r.lastInsertRowid)!,
          ),
        );
    }),
  );
  app.patch("/api/admin/users/:id", admin, (req, res) => {
    const id = integer(req.params.id, "User ID");
    const user = db
      .prepare<unknown[], UserRow>("SELECT * FROM users WHERE id=?")
      .get(id)!;
    if (!user) fail(404, "NOT_FOUND", "User not found.");
    if (
      typeof req.body.active !== "boolean" ||
      !["admin", "customer"].includes(req.body.role)
    )
      fail(400, "VALIDATION_ERROR", "Active boolean and role are required.");
    if (id === req.user.id && (!req.body.active || req.body.role !== "admin"))
      fail(
        409,
        "SELF_LOCKOUT",
        "You cannot disable or demote your own administrator account.",
      );
    db.prepare("UPDATE users SET active=?,role=? WHERE id=?").run(
      req.body.active ? 1 : 0,
      req.body.role,
      id,
    );
    res.json(
      publicUser(
        db
          .prepare<unknown[], UserRow>("SELECT * FROM users WHERE id=?")
          .get(id)!,
      ),
    );
  });
  app.get("/api/admin/bookings", admin, (req, res) =>
    res.json({
      items: db
        .prepare<unknown[], BookingRow>(bookingSelect + " ORDER BY b.id DESC")
        .all()
        .map(bookingOut),
    }),
  );
  app.get(
    "/api/weather",
    asyncRoute(async (req, res) => {
      const p = property(req.query.propertyId),
        url = new URL(config.weatherUrl);
      url.searchParams.set("latitude", String(p.latitude));
      url.searchParams.set("longitude", String(p.longitude));
      url.searchParams.set(
        "current",
        "temperature_2m,weather_code,wind_speed_10m",
      );
      url.searchParams.set("timezone", "auto");
      url.searchParams.set("temperature_unit", "celsius");
      url.searchParams.set("wind_speed_unit", "kmh");
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(config.weatherTimeout),
        });
        if (!response.ok) throw new Error("Upstream HTTP error");
        const body = (await response.json()) as {
            current?: {
              temperature_2m: number;
              weather_code: number;
              wind_speed_10m: number;
              time: string;
            };
          },
          current = body.current;
        if (
          !current ||
          !Number.isFinite(current.temperature_2m) ||
          !Number.isFinite(current.weather_code) ||
          !Number.isFinite(current.wind_speed_10m) ||
          typeof current.time !== "string"
        )
          throw new Error("Invalid upstream response");
        res.json({
          destination: p.destination,
          temperature: current.temperature_2m,
          weatherCode: current.weather_code,
          windSpeed: current.wind_speed_10m,
          time: current.time,
          temperatureUnit: "°C",
          windUnit: "km/h",
          source: "Open-Meteo",
        });
      } catch {
        fail(
          503,
          "WEATHER_UNAVAILABLE",
          "Current weather is unavailable. You can still book your stay.",
        );
      }
    }),
  );
  app.get("/api/openapi.json", (req, res) => res.json(openapi));
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapi));
  app.use("/api", (req, res, next) =>
    next(new ApiError(404, "NOT_FOUND", "API endpoint not found.")),
  );
  const dist = path.resolve(serverRoot, "../client/dist");
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get("*", (req, res) => res.sendFile(path.join(dist, "index.html")));
  }
  app.use(
    (
      err: Error & { status?: number; code?: string; type?: string },
      req: import("express").Request,
      res: import("express").Response,
      _next: import("express").NextFunction,
    ) => {
      let status = err.status || 500,
        code = err.code || "INTERNAL_ERROR",
        message = err.message;
      if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
        status = 409;
        code = "EMAIL_EXISTS";
        message = "This email address is already in use.";
      } else if (err.message?.includes("BOOKING_CONFLICT")) {
        status = 409;
        code = "BOOKING_CONFLICT";
        message = "This accommodation is unavailable for these dates.";
      } else if (err.type === "entity.parse.failed") {
        status = 400;
        code = "INVALID_JSON";
        message = "Request body must be valid JSON.";
      } else if (status === 500) {
        console.error(err);
        code = "INTERNAL_ERROR";
        message = "Something went wrong. Please try again.";
      }
      res.status(status).json({ error: { code, message } });
    },
  );
  return app;
}

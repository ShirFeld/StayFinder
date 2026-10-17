import { config } from "./config.js";
const ref = (name) => ({ $ref: "#/components/schemas/" + name });
const string = { type: "string" },
  integer = { type: "integer" };
const schemas = {
  Error: {
    type: "object",
    properties: {
      error: {
        type: "object",
        required: ["code", "message"],
        properties: { code: string, message: string },
      },
    },
  },
  User: {
    type: "object",
    properties: {
      id: integer,
      name: string,
      email: { type: "string", format: "email" },
      role: { enum: ["admin", "customer"] },
      active: { type: "boolean" },
    },
  },
  Property: {
    type: "object",
    properties: {
      id: integer,
      name: string,
      destination: string,
      description: string,
      price_cents: integer,
      capacity: integer,
      amenities: { type: "array", items: string },
      images: { type: "array", items: { type: "string", format: "uri" } },
      latitude: { type: "number" },
      longitude: { type: "number" },
      active: { type: "boolean" },
      currency: { enum: ["USD"] },
    },
  },
  PropertyInput: {
    type: "object",
    required: [
      "name",
      "destination",
      "description",
      "priceCents",
      "capacity",
      "amenities",
      "images",
      "latitude",
      "longitude",
    ],
    properties: {
      name: string,
      destination: string,
      description: string,
      priceCents: { type: "integer", minimum: 1 },
      capacity: { type: "integer", minimum: 1, maximum: 50 },
      amenities: {
        type: "array",
        items: {
          enum: [
            "WiFi",
            "Kitchen",
            "Pool",
            "Parking",
            "Air conditioning",
            "Pet friendly",
          ],
        },
      },
      images: {
        type: "array",
        minItems: 1,
        maxItems: 8,
        items: { type: "string", format: "uri" },
      },
      latitude: { type: "number", minimum: -90, maximum: 90 },
      longitude: { type: "number", minimum: -180, maximum: 180 },
      active: { type: "boolean" },
    },
  },
  BookingInput: {
    type: "object",
    required: ["propertyId", "checkIn", "checkOut", "guests"],
    properties: {
      propertyId: integer,
      checkIn: { type: "string", format: "date" },
      checkOut: { type: "string", format: "date" },
      guests: { type: "integer", minimum: 1 },
    },
    example: {
      propertyId: 1,
      checkIn: "2030-06-10",
      checkOut: "2030-06-13",
      guests: 2,
    },
  },
  Booking: {
    type: "object",
    properties: {
      id: integer,
      user_id: integer,
      property_id: integer,
      check_in: { type: "string", format: "date" },
      check_out: { type: "string", format: "date" },
      guests: integer,
      nights: integer,
      nightly_price_cents: integer,
      total_cents: integer,
      currency: { enum: ["USD"] },
      status: { enum: ["confirmed", "cancelled"] },
      property_name: string,
      destination: string,
      images: { type: "array", items: string },
      customer_name: string,
      customer_email: string,
      created_at: string,
      cancelled_at: { type: "string", nullable: true },
    },
  },
  Quote: {
    type: "object",
    properties: {
      available: { type: "boolean" },
      propertyId: integer,
      checkIn: string,
      checkOut: string,
      guests: integer,
      nights: integer,
      nightlyPriceCents: integer,
      totalCents: integer,
      currency: { enum: ["USD"] },
    },
  },
  Weather: {
    type: "object",
    properties: {
      destination: string,
      temperature: { type: "number" },
      weatherCode: integer,
      windSpeed: { type: "number" },
      time: string,
      temperatureUnit: string,
      windUnit: string,
      source: string,
    },
  },
};
const list = (name) => ({
  type: "object",
  properties: { items: { type: "array", items: ref(name) } },
});
const param = (name, type = "string", where = "query", required = false) => ({
  name,
  in: where,
  required,
  schema: { type },
});
const id = param("id", "integer", "path", true);
const op = (
  summary,
  schema,
  {
    auth = false,
    body,
    parameters = [],
    status = 200,
    description = "Public endpoint.",
  } = {},
) => ({
  summary,
  description,
  security: auth ? [{ session: [] }] : [],
  parameters,
  ...(body
    ? {
        requestBody: {
          required: true,
          content: { "application/json": { schema: body } },
        },
      }
    : {}),
  responses: {
    [status]: {
      description: "Success",
      ...(status === 204
        ? {}
        : { content: { "application/json": { schema } } }),
    },
    ...Object.fromEntries(
      [400, 401, 403, 404, 409, 429, 502, 503].map((s) => [
        s,
        {
          description: {
            400: "Invalid input",
            401: "Login required or invalid credentials",
            403: "Insufficient permission or rejected origin",
            404: "Resource not found",
            409: "Conflict with availability or business rules",
            429: "Rate limit",
            502: "Provider verification failed",
            503: "External provider unavailable or not configured",
          }[s],
          content: { "application/json": { schema: ref("Error") } },
        },
      ]),
    ),
  },
});
const admin = "Requires an active administrator session.";
const paths = {
  "/api/health": {
    get: op("Server health and business date", {
      type: "object",
      properties: {
        status: string,
        today: string,
        timezone: string,
        currency: string,
      },
    }),
  },
  "/api/auth/me": {
    get: op("Current session", {
      type: "object",
      properties: { user: { ...ref("User"), nullable: true } },
    }),
  },
  "/api/auth/login": {
    post: op(
      "Sign in",
      { type: "object", properties: { user: ref("User") } },
      {
        body: {
          type: "object",
          required: ["email", "password"],
          properties: { email: string, password: string },
          example: {
            email: "jamie@stayfinder.demo",
            password: "StayFinder123!",
          },
        },
      },
    ),
  },
  "/api/auth/logout": { post: op("Destroy session", {}, { status: 204 }) },
  "/api/destinations": {
    get: op("Available destinations", {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              destination: string,
              count: integer,
              latitude: { type: "number" },
              longitude: { type: "number" },
            },
          },
        },
      },
    }),
  },
  "/api/properties": {
    get: op(
      "Search active accommodation",
      {
        ...list("Property"),
        properties: {
          ...list("Property").properties,
          total: integer,
          page: integer,
          pageSize: integer,
          totalPages: integer,
        },
      },
      {
        parameters: ["destination", "checkIn", "checkOut", "amenities", "sort"]
          .map((n) => param(n))
          .concat(
            ["guests", "minPrice", "maxPrice", "page", "pageSize"].map((n) =>
              param(n, "integer"),
            ),
          ),
        description:
          "Prices in cents (USD); comma-separated amenities; sort: recommended, price_asc, price_desc, name. Dates must be supplied together. Page size defaults to 6.",
      },
    ),
  },
  "/api/properties/{id}": {
    get: op("Accommodation details", ref("Property"), { parameters: [id] }),
  },
  "/api/properties/{id}/availability": {
    get: op("Availability and server price quote", ref("Quote"), {
      parameters: [
        id,
        param("checkIn", "string", "query", true),
        param("checkOut", "string", "query", true),
        param("guests", "integer", "query", true),
      ],
      description:
        "409 when unavailable. Checkout is exclusive. No reservation is held by this quote.",
    }),
  },
  "/api/bookings": {
    get: op("My bookings", list("Booking"), {
      auth: true,
      description: "Only the current user’s bookings.",
    }),
    post: op("Book accommodation", ref("Booking"), {
      auth: true,
      body: ref("BookingInput"),
      status: 201,
      description:
        "Atomic availability check and insert. Server calculates and stores price; client price fields are ignored.",
    }),
  },
  "/api/bookings/{id}/cancel": {
    post: op("Cancel my booking", ref("Booking"), {
      auth: true,
      parameters: [id],
      description:
        "Before check-in day only. Repeated cancellation is idempotent. Other users’ bookings return 404.",
    }),
  },
  "/api/admin/properties": {
    get: op("All accommodation, including inactive", list("Property"), {
      auth: true,
      description: admin,
    }),
    post: op("Create accommodation", ref("Property"), {
      auth: true,
      description: admin,
      body: ref("PropertyInput"),
      status: 201,
    }),
  },
  "/api/admin/properties/{id}": {
    put: op("Edit or deactivate accommodation", ref("Property"), {
      auth: true,
      description:
        admin + " Full replacement. Deactivation preserves bookings.",
      parameters: [id],
      body: ref("PropertyInput"),
    }),
  },
  "/api/admin/users": {
    get: op("List users", list("User"), { auth: true, description: admin }),
    post: op("Create user", ref("User"), {
      auth: true,
      description: admin + " Unique email; password minimum 10 characters.",
      status: 201,
      body: {
        type: "object",
        required: ["name", "email", "password", "role"],
        properties: {
          name: string,
          email: string,
          password: { type: "string", minLength: 10 },
          role: { enum: ["admin", "customer"] },
        },
      },
    }),
  },
  "/api/admin/users/{id}": {
    patch: op("Change user role or status", ref("User"), {
      auth: true,
      description: admin + " Self-disable and self-demotion are rejected.",
      parameters: [id],
      body: {
        type: "object",
        required: ["active", "role"],
        properties: {
          active: { type: "boolean" },
          role: { enum: ["admin", "customer"] },
        },
      },
    }),
  },
  "/api/admin/bookings": {
    get: op("All bookings", list("Booking"), {
      auth: true,
      description: admin,
    }),
  },
  "/api/weather": {
    get: op("Current destination weather", ref("Weather"), {
      parameters: [param("propertyId", "integer", "query", true)],
      description:
        "Server proxy to Open-Meteo. Timeout or malformed response returns 503 without affecting bookings.",
    }),
  },
};
export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "StayFinder API",
    version: "1.0.0",
    description:
      "Local QA practice API. All money amounts are integer USD cents. Session cookies are HttpOnly.",
  },
  servers: [{ url: "/" }],
  components: {
    schemas,
    securitySchemes: {
      session: { type: "apiKey", in: "cookie", name: config.sessionName },
    },
  },
  paths,
};

Object.assign(schemas.User, {
  example: {
    id: 2,
    name: "Jamie Reed",
    email: "jamie@stayfinder.demo",
    role: "customer",
    active: true,
  },
});
Object.assign(schemas.Property, {
  example: {
    id: 1,
    name: "Lisbon Hideaway",
    destination: "Lisbon, Portugal",
    description: "One entire private apartment.",
    price_cents: 11000,
    capacity: 2,
    amenities: ["WiFi", "Kitchen"],
    images: ["https://images.unsplash.com/photo-1613490493576-7fde63acd811"],
    latitude: 38.7223,
    longitude: -9.1393,
    active: true,
    currency: "USD",
  },
});
Object.assign(schemas.Booking, {
  example: {
    id: 1,
    user_id: 2,
    property_id: 1,
    check_in: "2030-06-10",
    check_out: "2030-06-13",
    guests: 2,
    nights: 3,
    nightly_price_cents: 11000,
    total_cents: 33000,
    status: "confirmed",
    currency: "USD",
    property_name: "Lisbon Hideaway",
    destination: "Lisbon, Portugal",
    customer_name: "Jamie Reed",
    customer_email: "jamie@stayfinder.demo",
    images: [],
    created_at: "2030-05-01 12:00:00",
    cancelled_at: null,
  },
});
Object.assign(schemas.Quote, {
  example: {
    available: true,
    propertyId: 1,
    checkIn: "2030-06-10",
    checkOut: "2030-06-13",
    guests: 2,
    nights: 3,
    nightlyPriceCents: 11000,
    totalCents: 33000,
    currency: "USD",
  },
});
Object.assign(schemas.Weather, {
  example: {
    destination: "Lisbon, Portugal",
    temperature: 23,
    weatherCode: 0,
    windSpeed: 7,
    time: "2030-06-10T12:00",
    temperatureUnit: "°C",
    windUnit: "km/h",
    source: "Open-Meteo",
  },
});
Object.assign(schemas.PropertyInput, {
  example: {
    name: "Demo Cottage",
    destination: "Lisbon, Portugal",
    description: "One entire cottage.",
    priceCents: 11000,
    capacity: 2,
    amenities: ["WiFi"],
    images: ["https://images.unsplash.com/photo-1613490493576-7fde63acd811"],
    latitude: 38.7223,
    longitude: -9.1393,
    active: true,
  },
});
Object.assign(schemas.Error, {
  example: {
    error: {
      code: "BOOKING_CONFLICT",
      message: "This accommodation is unavailable for these dates.",
    },
  },
});

// Hosted sandbox checkout is the only path to a new confirmed booking.
Object.assign(schemas.Booking.properties, {
  checkout_id: { type: "string", nullable: true },
  payment_status: {
    enum: ["legacy", "paid", "refund_pending", "refunded", "refund_failed"],
  },
  refund_id: { type: "string", nullable: true },
});
schemas.Checkout = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    propertyId: integer,
    propertyName: string,
    checkIn: { type: "string", format: "date" },
    checkOut: { type: "string", format: "date" },
    guests: integer,
    nights: integer,
    nightlyPriceCents: integer,
    totalCents: integer,
    currency: { enum: ["USD"] },
    status: {
      enum: [
        "creating",
        "open",
        "completed",
        "expired",
        "cancelled",
        "failed",
        "refund_pending",
        "refunded",
      ],
    },
    expiresAt: { type: "integer", description: "Unix timestamp in seconds" },
    checkoutUrl: { type: "string", nullable: true },
    cancellationRequested: { type: "boolean" },
    booking: { ...ref("Booking"), nullable: true },
  },
  example: {
    id: "f8df6680-334a-4436-bbda-0833f604fb53",
    propertyId: 1,
    propertyName: "Lisbon Hideaway",
    checkIn: "2030-06-10",
    checkOut: "2030-06-13",
    guests: 2,
    nights: 3,
    nightlyPriceCents: 11000,
    totalCents: 33000,
    currency: "USD",
    status: "open",
    expiresAt: 1907341200,
    checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_example",
    cancellationRequested: false,
    booking: null,
  },
};
const checkoutId = param("id", "string", "path", true);
paths["/api/checkouts"] = {
  get: op("My checkouts and temporary holds", list("Checkout"), {
    auth: true,
    description:
      "Latest 50 owned checkouts, including payment/refund status. Expired holds do not block availability.",
  }),
  post: op("Hold dates and open Stripe sandbox Checkout", ref("Checkout"), {
    auth: true,
    status: 201,
    body: ref("BookingInput"),
    parameters: [
      {
        name: "Idempotency-Key",
        in: "header",
        required: true,
        schema: {
          type: "string",
          minLength: 16,
          maxLength: 100,
          pattern: "^[A-Za-z0-9_-]+$",
        },
        example: "b99231af-2c77-4a3e-8d9e-73ddc8122b71",
      },
    ],
    description:
      "Atomically holds dates and snapshots server prices. No booking is created. Card-only Stripe sandbox; about 31-minute expiry. Same request key and input returns the same checkout; changed input returns 409 IDEMPOTENCY_CONFLICT. 409 on overlap or 5 active owned holds; 503 if not configured/provider unavailable. Retry the same key after an uncertain network error.",
  }),
};
paths["/api/checkouts/{id}"] = {
  get: op("Read my checkout", ref("Checkout"), {
    auth: true,
    parameters: [checkoutId],
    description: "Owner only; other users receive 404. Read-only local state.",
  }),
};
paths["/api/checkouts/{id}/sync"] = {
  post: op("Verify payment or refund with Stripe", ref("Checkout"), {
    auth: true,
    parameters: [checkoutId],
    description:
      "Retrieves authoritative Stripe data; validates sandbox mode, session ID, metadata, amount and currency. Confirms exactly one booking only when paid. Late or cancelled payments are refunded. Never trusts browser URL parameters.",
  }),
};
paths["/api/checkouts/{id}/cancel"] = {
  post: op("Cancel checkout and release held dates", ref("Checkout"), {
    auth: true,
    parameters: [checkoutId],
    description:
      "Persists cancellation intent and expires Stripe session before releasing availability. A racing payment is refunded; a provider outage keeps the hold until safe release/expiry. Already confirmed bookings require the booking cancellation endpoint.",
  }),
};
paths["/api/payments/webhook"] = {
  post: op(
    "Receive signed Stripe sandbox events",
    { type: "object", properties: { received: { type: "boolean" } } },
    {
      parameters: [
        {
          name: "Stripe-Signature",
          in: "header",
          required: true,
          schema: { type: "string" },
        },
      ],
      body: {
        type: "object",
        description:
          "Raw Stripe event payload; must preserve exact signed bytes.",
      },
      description:
        "No user session required. Stripe signature and timestamp verified with the webhook secret. Live events rejected. Handles checkout completion/expiry and refund updates; safe to replay. Fetches payment state from Stripe instead of trusting payload payment amounts.",
    },
  ),
};
paths["/api/bookings"].post = op("Direct booking disabled", ref("Error"), {
  auth: true,
  status: 409,
  description:
    "Use POST /api/checkouts. This route always returns 409 PAYMENT_REQUIRED and never creates bookings.",
});
paths["/api/bookings/{id}/cancel"].post.description =
  "Owner only; before check-in day for the first cancellation. Paid bookings request a full sandbox refund. Cancellation and refund intent are durable before contacting Stripe; refund_pending/refund_failed are distinct from refunded. Repeated calls preserve cancellation time and do not duplicate refunds. Retry failed/pending refunds even after the original cutoff. Older legacy bookings cancel without a refund.";

Object.assign(schemas.Checkout.properties, {
  serverTime: {
    type: "integer",
    description: "Server Unix time in seconds, used for the hold countdown",
  },
  verificationPending: {
    type: "boolean",
    description:
      "Hold expired locally; final provider status still needs verification",
  },
  refundStatus: { enum: ["none", "pending", "failed", "succeeded"] },
});
paths["/api/checkouts/{id}/refund"] = {
  post: op("Retry an owned pending or failed refund", ref("Checkout"), {
    auth: true,
    parameters: [checkoutId],
    description:
      "Owner only. Retries an unfinished full refund, including a late-payment refund without a booking. Succeeded refunds are idempotent. Other checkout states return 409 REFUND_NOT_AVAILABLE. Does not cancel a confirmed booking.",
  }),
};

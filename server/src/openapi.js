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
      [400, 401, 403, 404, 409, 429, 503].map((s) => [
        s,
        {
          description: {
            400: "Invalid input",
            401: "Login required or invalid credentials",
            403: "Insufficient permission or rejected origin",
            404: "Resource not found",
            409: "Conflict with availability or business rules",
            429: "Rate limit",
            503: "Weather provider unavailable",
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
      session: { type: "apiKey", in: "cookie", name: "stayfinder.sid" },
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

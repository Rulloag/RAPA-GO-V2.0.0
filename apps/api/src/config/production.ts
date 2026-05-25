/**
 * Production configuration constants.
 * Import-and-use — no side effects.
 */

export const productionConfig = {
  server: {
    port:           Number(process.env["PORT"] ?? 3000),
    host:           process.env["HOST"] ?? "0.0.0.0",
    requestTimeout: 30_000,
  },

  rateLimit: {
    global:    { max: 100,  timeWindow: "1 minute" },
    auth:      { max: 10,   timeWindow: "1 minute" },
    healthCheck: { max: 300, timeWindow: "1 minute" },
  },

  cors: {
    // Comma-separated list via CORS_ORIGIN env var; falls back to false (deny all) in prod.
    origins: process.env["CORS_ORIGIN"]
      ? process.env["CORS_ORIGIN"].split(",").map(s => s.trim()).filter(Boolean)
      : false as const,
    methods:        ["GET", "POST", "PATCH", "DELETE", "OPTIONS"] as const,
    allowedHeaders: ["Content-Type", "Authorization"] as const,
    credentials:    true,
  },

  logging: {
    // JSON structured logging for log aggregators (Railway, Datadog, etc.)
    level:      process.env["LOG_LEVEL"] ?? "warn",
    prettyPrint: false,
  },

  db: {
    maxConnections: 10,
    idleTimeout:    20,
    connectTimeout: 10,
  },

  jwt: {
    // Minimum recommended: 64 random bytes (openssl rand -hex 64)
    secret: process.env["JWT_SECRET"] ?? "",
  },
} as const;

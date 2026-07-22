/**
 * Typed, validated access to environment variables for the API.
 * Fails fast at startup if required variables are missing.
 * Never export this module to the mobile client.
 */

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const env = {
  nodeEnv: optionalEnv("NODE_ENV", "development") as
    | "development"
    | "staging"
    | "production",
  port: Number(optionalEnv("PORT", "3000")),
  host: optionalEnv("HOST", "0.0.0.0"),

  // Supabase — loaded lazily so tests can start without them
  get supabaseUrl() { return requireEnv("SUPABASE_URL"); },
  get supabaseServiceRoleKey() { return requireEnv("SUPABASE_SERVICE_ROLE_KEY"); },
  get supabaseJwtSecret() { return requireEnv("SUPABASE_JWT_SECRET"); },

  // Platform
  platformCommissionPercent: Number(optionalEnv("PLATFORM_COMMISSION_PERCENT", "15")),
} as const;

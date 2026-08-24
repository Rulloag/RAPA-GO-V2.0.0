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
  get nodeEnv(): "development" | "staging" | "production" {
    const value = optionalEnv("NODE_ENV", "development");
    if (value === "production" || value === "staging") return value;
    return "development";
  },
  port: Number(optionalEnv("PORT", "3000")),
  host: optionalEnv("HOST", "0.0.0.0"),

  // Supabase — loaded lazily so tests can start without them
  get supabaseUrl() { return requireEnv("SUPABASE_URL"); },
  get supabaseServiceRoleKey() { return requireEnv("SUPABASE_SERVICE_ROLE_KEY"); },
  get supabaseJwtSecret() { return requireEnv("SUPABASE_JWT_SECRET"); },

  // Platform
  platformCommissionPercent: Number(optionalEnv("PLATFORM_COMMISSION_PERCENT", "23")),

  get frontendUrl(): string {
    const configured = String(
      process.env["FRONTEND_URL"] ?? "",
    ).trim();

    if (configured) {
      const parsed = new URL(configured);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        throw new Error("FRONTEND_URL must use http or https.");
      }
      if (this.nodeEnv === "production" && parsed.protocol !== "https:") {
        throw new Error("FRONTEND_URL must use HTTPS in production.");
      }
      if (
        this.nodeEnv === "production" &&
        /^(localhost|127\.0\.0\.1)$/i.test(parsed.hostname)
      ) {
        throw new Error("FRONTEND_URL must not use localhost in production.");
      }
      return parsed.origin;
    }

    if (this.nodeEnv === "production") {
      throw new Error("Missing required environment variable: FRONTEND_URL");
    }

    return "http://localhost:5173";
  },

  // WhatsApp Business Cloud API (Meta)
  // Credentials are only required when whatsapp.enabled = true.
  // Never log these values.
  get whatsapp() {
    const enabled = optionalEnv("WHATSAPP_ENABLED", "false") === "true";

    if (enabled) {
      const missing: string[] = [];
      if (!process.env["WHATSAPP_PHONE_NUMBER_ID"])   missing.push("WHATSAPP_PHONE_NUMBER_ID");
      if (!process.env["WHATSAPP_ACCESS_TOKEN"])       missing.push("WHATSAPP_ACCESS_TOKEN");
      if (!process.env["WHATSAPP_APP_SECRET"])         missing.push("WHATSAPP_APP_SECRET");
      if (!process.env["WHATSAPP_VERIFY_TOKEN"])       missing.push("WHATSAPP_VERIFY_TOKEN");
      if (missing.length > 0) {
        throw new Error(`WHATSAPP_ENABLED=true but missing required variables: ${missing.join(", ")}`);
      }
    }

    return {
      enabled,
      provider:           optionalEnv("WHATSAPP_PROVIDER",             "meta"),
      phoneNumberId:      optionalEnv("WHATSAPP_PHONE_NUMBER_ID",      ""),
      businessAccountId:  optionalEnv("WHATSAPP_BUSINESS_ACCOUNT_ID",  ""),
      accessToken:        optionalEnv("WHATSAPP_ACCESS_TOKEN",         ""),
      appSecret:          optionalEnv("WHATSAPP_APP_SECRET",           ""),
      verifyToken:        optionalEnv("WHATSAPP_VERIFY_TOKEN",         ""),
      apiVersion:         optionalEnv("WHATSAPP_API_VERSION",          "v20.0"),
    } as const;
  },
} as const;

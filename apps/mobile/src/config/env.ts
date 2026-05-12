/**
 * Typed access to environment variables for the mobile app.
 * All values come from VITE_ prefixed variables — never secrets.
 * Actual values are set in .env (not committed). See .env.example.
 */
export const env = {
  supabaseUrl: import.meta.env["VITE_SUPABASE_URL"] as string,
  supabaseAnonKey: import.meta.env["VITE_SUPABASE_ANON_KEY"] as string,
  googleMapsApiKey: import.meta.env["VITE_GOOGLE_MAPS_API_KEY"] as string,
  apiBaseUrl: import.meta.env["VITE_API_BASE_URL"] as string,
  environment: (import.meta.env["VITE_ENV"] ?? "development") as
    | "development"
    | "staging"
    | "production",
} as const;

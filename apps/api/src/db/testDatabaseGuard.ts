const BLOCKED_DATABASE_HOST_FRAGMENTS = [
  "supabase.co",
  "supabase.com",
  "amazonaws.com",
  "hostinger",
  "neon.tech",
  "render.com",
  "railway.app",
  "planetscale",
  "azure.com",
  "googleusercontent.com",
];

const ALLOWED_DATABASE_HOST_FRAGMENTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "postgres",
  "quality_gate",
  "rapago_test",
  "rapago_microgate",
];

export function assertSafeCertificationDatabaseUrl(
  databaseUrl: string,
  context: string,
): void {
  const lower = databaseUrl.toLowerCase();

  for (const blocked of BLOCKED_DATABASE_HOST_FRAGMENTS) {
    if (lower.includes(blocked)) {
      throw new Error(
        `[${context}] Refusing to run against non-local DATABASE_URL (${blocked}).`,
      );
    }
  }

  const allowed = ALLOWED_DATABASE_HOST_FRAGMENTS.some((fragment) =>
    lower.includes(fragment),
  );
  if (!allowed) {
    throw new Error(
      `[${context}] DATABASE_URL host/db is not an approved local/CI test target.`,
    );
  }
}

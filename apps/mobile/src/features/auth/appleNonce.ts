/**
 * appleNonce — generates the raw/hashed nonce pair used by the Apple
 * Sign-In flow.
 *
 * CONTRACT (verified against @capawesome/capacitor-apple-sign-in's native
 * iOS source — AppleSignIn.swift sets `request.nonce = options.nonce`
 * verbatim on ASAuthorizationAppleIDRequest; Apple does NOT hash it before
 * embedding it as the `nonce` claim in the returned identityToken):
 *
 *   1. Generate a cryptographically random raw nonce here.
 *   2. Pass SHA-256(raw) — the *hashed* value — to the plugin's `signIn()`
 *      call. Apple embeds that hashed value, unchanged, as the identity
 *      token's `nonce` claim.
 *   3. Send the *raw* (unhashed) nonce to the backend.
 *   4. The backend independently computes SHA-256(raw) once and compares
 *      it to the token's `nonce` claim (constant-time).
 *
 * Each side performs exactly one hash of the same raw value — this is a
 * nonce commitment, not a double hash. Getting this backwards (sending the
 * raw nonce to the plugin, or a hash to the backend) silently breaks every
 * real sign-in with AUTH_APPLE_NONCE_MISMATCH.
 *
 * Uses only Web Crypto (available in Capacitor's WKWebView on iOS) — never
 * Math.random(), a timestamp, or a fixed value.
 */

const RAW_NONCE_BYTES = 32;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(digest));
}

export interface AppleNoncePair {
  /** Sent to the backend as-is. Never sent to Apple. */
  raw: string;
  /** Passed to the plugin's signIn({ nonce }) option. Never sent to the backend. */
  hashed: string;
}

export async function generateAppleNoncePair(): Promise<AppleNoncePair> {
  const bytes = new Uint8Array(RAW_NONCE_BYTES);
  crypto.getRandomValues(bytes);
  const raw = toHex(bytes);
  const hashed = await sha256Hex(raw);
  return { raw, hashed };
}

const RAW_NONCE_BYTES = 32;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return toHex(new Uint8Array(digest));
}

export interface AppleNoncePair {
  raw: string;
  hashed: string;
}

export async function generateAppleNoncePair(): Promise<AppleNoncePair> {
  const bytes = new Uint8Array(RAW_NONCE_BYTES);
  crypto.getRandomValues(bytes);
  const raw = toHex(bytes);
  return { raw, hashed: await sha256Hex(raw) };
}

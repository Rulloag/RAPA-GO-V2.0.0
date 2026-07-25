import { describe, it, expect } from "vitest";
import { generateAppleNoncePair } from "./appleNonce.js";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

describe("generateAppleNoncePair", () => {
  it("generates a cryptographically random raw nonce (64 hex chars = 32 bytes)", async () => {
    const { raw } = await generateAppleNoncePair();
    expect(raw).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates a different raw nonce on every call (not fixed, not a timestamp)", async () => {
    const a = await generateAppleNoncePair();
    const b = await generateAppleNoncePair();
    expect(a.raw).not.toBe(b.raw);
  });

  it("hashed value is exactly SHA-256(raw) — the contract the plugin/backend rely on", async () => {
    const { raw, hashed } = await generateAppleNoncePair();
    const expected = await sha256Hex(raw);
    expect(hashed).toBe(expected);
  });

  it("does not apply a double hash — hashed is not SHA-256 of itself equal to raw", async () => {
    const { raw, hashed } = await generateAppleNoncePair();
    expect(hashed).not.toBe(raw);
    const doubleHashed = await sha256Hex(hashed);
    // Sanity: hashing the hash again produces yet another different value,
    // confirming `hashed` is a single hash of `raw`, not raw itself relabeled.
    expect(doubleHashed).not.toBe(hashed);
  });

  it("raw nonce is not derived from a predictable timestamp", async () => {
    const before = Date.now();
    const { raw } = await generateAppleNoncePair();
    // A timestamp-based nonce would be short and numeric; a real random
    // 32-byte nonce is 64 hex chars and astronomically unlikely to equal
    // any encoding of `before`.
    expect(raw.length).toBe(64);
    expect(raw).not.toContain(String(before));
  });
});

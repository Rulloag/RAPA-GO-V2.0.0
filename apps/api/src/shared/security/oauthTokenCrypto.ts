import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { AppError } from "../errors/AppError.js";

/**
 * OAuthTokenCrypto — AES-256-GCM authenticated encryption for third-party
 * OAuth refresh tokens (e.g. Apple's) before they're persisted.
 *
 * SECURITY rules:
 *  - OAUTH_TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 raw
 *    bytes / AES-256). Generate with: openssl rand -hex 32.
 *  - Fails closed: any missing or malformed key throws immediately, at the
 *    point of use — the caller must treat this as "cannot store the token",
 *    never silently fall back to storing plaintext.
 *  - GCM's auth tag is verified on decrypt; a tampered ciphertext throws
 *    rather than returning corrupted data.
 */
const ALGORITHM = "aes-256-gcm";
const KEY_HEX_LENGTH = 64; // 32 bytes
const IV_BYTES = 12; // 96-bit nonce, standard for GCM

function getEncryptionKey(): Buffer {
  const raw = process.env["OAUTH_TOKEN_ENCRYPTION_KEY"];
  if (!raw) {
    throw new AppError({
      code: "AUTH_CONFIGURATION_ERROR",
      message: "OAUTH_TOKEN_ENCRYPTION_KEY is not configured. Cannot store OAuth tokens securely.",
      statusCode: 503,
    });
  }
  if (raw.length !== KEY_HEX_LENGTH || !/^[0-9a-fA-F]+$/.test(raw)) {
    throw new AppError({
      code: "AUTH_CONFIGURATION_ERROR",
      message: `OAUTH_TOKEN_ENCRYPTION_KEY must be a ${KEY_HEX_LENGTH}-character hex string (32 bytes).`,
      statusCode: 503,
    });
  }
  return Buffer.from(raw, "hex");
}

export const OAuthTokenCrypto = {
  /** Encrypts plaintext into "iv:ciphertext:authTag", all hex-encoded. */
  encrypt(plaintext: string): string {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${ciphertext.toString("hex")}:${authTag.toString("hex")}`;
  },

  /** Decrypts a value produced by encrypt(). Throws if the payload is malformed or tampered. */
  decrypt(payload: string): string {
    const key = getEncryptionKey();
    const parts = payload.split(":");
    if (parts.length !== 3) {
      throw AppError.internal("Malformed encrypted OAuth token payload.");
    }
    const [ivHex, ciphertextHex, authTagHex] = parts as [string, string, string];
    try {
      const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
      decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(ciphertextHex, "hex")),
        decipher.final(),
      ]);
      return plaintext.toString("utf8");
    } catch {
      throw AppError.internal("Failed to decrypt OAuth token — payload may be corrupted or tampered.");
    }
  },
};

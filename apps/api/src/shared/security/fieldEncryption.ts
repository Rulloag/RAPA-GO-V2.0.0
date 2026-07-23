import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const ENCRYPTION_VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

function getEncryptionKey(): Buffer {
  const configured = process.env["BANK_ACCOUNT_ENCRYPTION_KEY"]?.trim();

  if (!configured) {
    throw new Error(
      "Missing BANK_ACCOUNT_ENCRYPTION_KEY. Configure a dedicated server-side secret before storing bank accounts.",
    );
  }

  if (/^[a-f0-9]{64}$/i.test(configured)) {
    return Buffer.from(configured, "hex");
  }

  try {
    const decoded = Buffer.from(configured, "base64");
    if (decoded.length === 32) return decoded;
  } catch {
    // Continue with the SHA-256 normalization below.
  }

  if (configured.length < 32) {
    throw new Error(
      "BANK_ACCOUNT_ENCRYPTION_KEY must contain at least 32 characters.",
    );
  }

  return createHash("sha256").update(configured, "utf8").digest();
}

export function encryptSensitiveValue(plainText: string): string {
  const normalized = plainText.trim();
  if (!normalized) throw new Error("Cannot encrypt an empty value.");

  const key = getEncryptionKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(normalized, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptSensitiveValue(payload: string): string {
  const [version, ivPart, tagPart, encryptedPart] = payload.split(".");

  if (
    version !== ENCRYPTION_VERSION ||
    !ivPart ||
    !tagPart ||
    !encryptedPart
  ) {
    throw new Error("Unsupported encrypted value format.");
  }

  const key = getEncryptionKey();
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

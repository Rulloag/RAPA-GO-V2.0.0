import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { AppError } from "../errors/AppError.js";

const ALGORITHM = "aes-256-gcm";
const KEY_HEX_LENGTH = 64;
const IV_BYTES = 12;

function getEncryptionKey(): Buffer {
  const raw = process.env["OAUTH_TOKEN_ENCRYPTION_KEY"]?.trim() ?? "";
  if (!/^[a-f0-9]{64}$/i.test(raw) || raw.length !== KEY_HEX_LENGTH) {
    throw new AppError({
      code: "AUTH_CONFIGURATION_ERROR",
      message: "OAUTH_TOKEN_ENCRYPTION_KEY debe ser una clave hexadecimal de 64 caracteres.",
      statusCode: 503,
    });
  }
  return Buffer.from(raw, "hex");
}

export const OAuthTokenCrypto = {
  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    return `${iv.toString("hex")}:${ciphertext.toString("hex")}:${cipher
      .getAuthTag()
      .toString("hex")}`;
  },

  decrypt(payload: string): string {
    const [ivHex, ciphertextHex, authTagHex] = payload.split(":");
    if (!ivHex || !ciphertextHex || !authTagHex) {
      throw AppError.internal("El token OAuth cifrado tiene un formato inválido.");
    }

    try {
      const decipher = createDecipheriv(
        ALGORITHM,
        getEncryptionKey(),
        Buffer.from(ivHex, "hex"),
      );
      decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertextHex, "hex")),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      throw AppError.internal("No fue posible descifrar el token OAuth.");
    }
  },
};

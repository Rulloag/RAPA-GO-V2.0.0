import argon2 from "argon2";

/**
 * PasswordService — secure password hashing and verification using argon2id.
 *
 * SECURITY rules:
 *  - Never log a raw password. Never include it in audit metadata.
 *  - Never return a hash in API responses — hashes stay inside the auth module.
 *  - argon2id is the recommended variant: resistant to both side-channel and
 *    GPU cracking attacks.
 */
export class PasswordService {
  private static readonly OPTIONS: argon2.Options = {
    type:        argon2.argon2id,
    memoryCost:  65536,  // 64 MiB
    timeCost:    3,
    parallelism: 4,
  };

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, PasswordService.OPTIONS);
  }

  async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      // argon2.verify throws on malformed hash — treat as mismatch, not a crash
      return false;
    }
  }
}

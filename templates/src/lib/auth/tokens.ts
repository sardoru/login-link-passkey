import { createHash, randomBytes } from "node:crypto";

/** A single-use magic-link token. Only the hash is ever stored. */
export function generateMagicToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

import { randomBytes, randomInt } from "node:crypto";
import { hashToken } from "./tokens";
import { INVITE_TTL_DAYS, SITE_URL } from "./config";

export { hashToken };

/** Invite token — same shape as a magic link, but a 3-day life. Hash only is stored. */
export function generateInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function inviteExpiry(days: number = INVITE_TTL_DAYS): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

export function inviteUrl(token: string): string {
  return `${SITE_URL}/invite/${token}`;
}

/**
 * Human-shareable access code: PREFIX-XXXX-XXXX in Crockford base32 (no I, L,
 * O, U — nothing that gets misread over the phone or in a screenshot).
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function generateAccessCode(prefix?: string): string {
  const block = () =>
    Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  const head = (prefix ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
  return [head || block(), block(), block()].join("-");
}

export function normalizeAccessCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

export function joinUrl(code?: string): string {
  return code ? `${SITE_URL}/join?code=${encodeURIComponent(code)}` : `${SITE_URL}/join`;
}

export interface CodeState {
  status: "active" | "revoked" | "expired" | "exhausted";
  remaining: number;
}

export function accessCodeState(row: {
  max_uses: number;
  uses: number;
  expires_at: string | null;
  revoked_at: string | null;
}): CodeState {
  const remaining = Math.max(0, row.max_uses - row.uses);
  if (row.revoked_at) return { status: "revoked", remaining };
  if (row.expires_at && new Date(row.expires_at) <= new Date()) {
    return { status: "expired", remaining };
  }
  if (remaining <= 0) return { status: "exhausted", remaining: 0 };
  return { status: "active", remaining };
}

export function inviteState(row: {
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}): "accepted" | "revoked" | "expired" | "pending" {
  if (row.accepted_at) return "accepted";
  if (row.revoked_at) return "revoked";
  if (new Date(row.expires_at) <= new Date()) return "expired";
  return "pending";
}

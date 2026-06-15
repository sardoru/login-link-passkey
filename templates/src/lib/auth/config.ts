// ---------------------------------------------------------------------------
// Auth configuration — reads environment lazily so the build never fails on a
// missing secret (only the actual request path throws if misconfigured).
// ---------------------------------------------------------------------------

import { BRAND } from "./brand";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const RP_NAME = process.env.AUTH_RP_NAME ?? BRAND.appName;

export const SESSION_COOKIE = "auth_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
export const MAGIC_TTL_MIN = 15;
export const CHALLENGE_COOKIE_REG = "auth_wa_reg";
export const CHALLENGE_COOKIE_AUTH = "auth_wa_auth";

/** HS256 signing key for sessions + WebAuthn challenge cookies. */
export function jwtKey(): Uint8Array {
  return new TextEncoder().encode(req("AUTH_JWT_SECRET"));
}

export function supabaseConfig() {
  return {
    url: req("SUPABASE_URL"),
    serviceKey: req("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export function resendConfig() {
  return {
    apiKey: req("RESEND_API_KEY"),
    from:
      process.env.AUTH_EMAIL_FROM ?? `${BRAND.appName} <onboarding@resend.dev>`,
  };
}

/** Allow-listed emails. Empty list ⇒ open (a warning is logged at call sites). */
export function allowedEmails(): string[] {
  return (process.env.AUTH_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

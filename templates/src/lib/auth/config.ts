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

/** Admin-generated invite links live for 3 days. */
export const INVITE_TTL_DAYS = Number(process.env.AUTH_INVITE_TTL_DAYS ?? 3);
/** Default seats on a new access code (admin can pick any value ≥ 1). */
export const ACCESS_CODE_DEFAULT_USES = Number(
  process.env.AUTH_CODE_DEFAULT_USES ?? 10
);
/**
 * Where an admin-sent "set up your passkey" link lands after the magic link
 * signs the person in. `<PasskeyPrompt/>` sees `?passkey=setup` and opens the
 * one-tap enrolment even if the user dismissed it before or already has one.
 * Point this at any authed page that renders <PasskeyPrompt/>.
 */
export const PASSKEY_SETUP_PATH =
  process.env.AUTH_PASSKEY_SETUP_PATH ?? "/?passkey=setup";
/** Public waitlist page + API. Off ⇒ /waitlist 404s and the API refuses. */
export const WAITLIST_ENABLED =
  (process.env.AUTH_WAITLIST_ENABLED ?? "true") !== "false";

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
  return splitList(process.env.AUTH_ALLOWED_EMAILS);
}

/**
 * Emails promoted to `owner` the first time they sign in. Use this to bootstrap
 * the very first admin without touching SQL.
 */
export function bootstrapOwners(): string[] {
  return splitList(process.env.AUTH_BOOTSTRAP_OWNERS);
}

function splitList(v: string | undefined): string[] {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

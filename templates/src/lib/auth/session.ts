// Edge-safe session + challenge tokens (jose only — used by proxy and routes).

import { SignJWT, jwtVerify } from "jose";
import { jwtKey, SESSION_MAX_AGE } from "./config";

export interface SessionPayload {
  sub: string; // user id
  email: string;
  name?: string;
  role?: string;
  /**
   * Effective permission keys, snapshotted at sign-in. The edge proxy trusts
   * this for *routing* only. Every admin API re-resolves permissions from the
   * database, so a stale token can never actually perform an action it lost.
   * `/api/auth/me` re-issues the cookie whenever the DB disagrees.
   */
  perms?: string[];
}

export async function signSession(p: SessionPayload): Promise<string> {
  return new SignJWT({
    email: p.email,
    ...(p.name ? { name: p.name } : {}),
    ...(p.role ? { role: p.role } : {}),
    ...(p.perms ? { perms: p.perms } : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(p.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(jwtKey());
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, jwtKey());
    if (!payload.sub || typeof payload.email !== "string") return null;
    return {
      sub: String(payload.sub),
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : undefined,
      role: typeof payload.role === "string" ? payload.role : undefined,
      perms: Array.isArray(payload.perms)
        ? (payload.perms as unknown[]).map(String)
        : undefined,
    };
  } catch {
    return null;
  }
}

/** Short-lived signed cookie used to carry a WebAuthn challenge between requests. */
export async function signChallenge(
  data: Record<string, unknown>,
  ttlSeconds = 300
): Promise<string> {
  return new SignJWT(data)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(jwtKey());
}

export async function verifyChallenge(
  token: string | undefined | null
): Promise<Record<string, unknown> | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, jwtKey());
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

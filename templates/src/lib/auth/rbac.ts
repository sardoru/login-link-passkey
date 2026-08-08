// ---------------------------------------------------------------------------
// Server-side authorization. The session cookie is a *cache*; this module is
// the authority. Every admin route calls `requirePermission` before touching
// data, so a stale or hand-forged-but-signed token still can't act.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getSession } from "./server";
import { getUserByEmail, upsertUser, type AuthUser } from "./db";
import { getRole, countUsersWithRole, audit } from "./admin-db";
import { bootstrapOwners, allowedEmails } from "./config";
import { normalizeEmail } from "./allowlist";
import {
  can,
  effectivePermissions,
  type UserOverrides,
} from "./permissions";
import type { SessionPayload } from "./session";

export interface Actor {
  user: AuthUser;
  perms: string[];
  session: SessionPayload;
}

/** Role permissions ∪ user grants − user denies, resolved from the database. */
export async function permissionsForUser(user: AuthUser): Promise<string[]> {
  const role = await getRole(user.role ?? "member");
  return effectivePermissions(
    role?.permissions,
    (user.permissions ?? {}) as UserOverrides
  );
}

/** Build the JWT payload for a freshly signed-in (or refreshed) user. */
export async function sessionPayloadFor(
  user: AuthUser
): Promise<SessionPayload> {
  return {
    sub: user.id,
    email: user.email,
    name: user.name ?? undefined,
    role: user.role ?? "member",
    perms: await permissionsForUser(user),
  };
}

/** The signed-in user as the database sees them right now. */
export async function currentActor(): Promise<Actor | null> {
  const session = await getSession();
  if (!session) return null;
  const user = await getUserByEmail(session.email);
  if (!user) return null;
  if (user.status === "suspended") return null;
  return { user, perms: await permissionsForUser(user), session };
}

export type Guard =
  | { ok: true; actor: Actor }
  | { ok: false; response: NextResponse };

/**
 * Route-handler guard.
 *
 *   const g = await requirePermission("users.write");
 *   if (!g.ok) return g.response;
 *   // …g.actor is authorized
 */
export async function requirePermission(
  ...keys: string[]
): Promise<Guard> {
  const actor = await currentActor();
  if (!actor) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not signed in." }, { status: 401 }),
    };
  }
  const missing = keys.filter((k) => !can(actor.perms, k));
  if (missing.length) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "You don't have permission to do that.", missing },
        { status: 403 }
      ),
    };
  }
  return { ok: true, actor };
}

/**
 * Promote bootstrap emails (AUTH_BOOTSTRAP_OWNERS) to owner on sign-in, so the
 * first admin exists without running SQL. Idempotent.
 */
export async function maybeBootstrapOwner(user: AuthUser): Promise<AuthUser> {
  const owners = bootstrapOwners();
  if (!owners.includes(normalizeEmail(user.email))) return user;
  if (user.role === "owner" && user.status === "active") return user;
  const promoted = await upsertUser(user.email, {
    role: "owner",
    status: "active",
  });
  await audit({
    actorEmail: user.email,
    action: "user.bootstrap_owner",
    target: user.email,
  });
  return promoted;
}

/**
 * May this address sign in? The env allow-list still applies, but anyone the
 * admin has already created / invited / who redeemed an access code is allowed
 * without editing environment variables.
 */
export async function isSignInAllowed(email: string): Promise<boolean> {
  const e = normalizeEmail(email);
  const user = await getUserByEmail(e);
  if (user) return user.status !== "suspended";
  const list = allowedEmails();
  return list.length === 0 || list.includes(e);
}

/** Refuse to demote, suspend, or delete the last active owner. */
export async function blocksLastOwner(
  target: AuthUser,
  patch: { role?: string; status?: string } | "delete"
): Promise<boolean> {
  if (target.role !== "owner" || target.status !== "active") return false;
  const losingOwner =
    patch === "delete" ||
    (patch.role !== undefined && patch.role !== "owner") ||
    (patch.status !== undefined && patch.status !== "active");
  if (!losingOwner) return false;
  return (await countUsersWithRole("owner")) <= 1;
}

/**
 * Privilege-escalation guard: you may not grant a permission you don't hold,
 * nor assign a role that exceeds your own permissions. Owners bypass.
 */
export async function canConferRole(
  actor: Actor,
  roleKey: string
): Promise<boolean> {
  if (actor.user.role === "owner") return true;
  const role = await getRole(roleKey);
  if (!role) return false;
  const target = effectivePermissions(role.permissions, {});
  return target.every((k) => can(actor.perms, k));
}

export function canConferPermissions(
  actor: Actor,
  overrides: UserOverrides
): boolean {
  if (actor.user.role === "owner") return true;
  return (overrides.grant ?? []).every((k) => can(actor.perms, k));
}

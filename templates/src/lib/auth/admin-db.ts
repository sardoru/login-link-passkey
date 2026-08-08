// ---------------------------------------------------------------------------
// Admin data access — users, roles, invites, access codes, waitlist, audit.
// Server-only (service-role key). Every function here assumes the caller has
// already been permission-checked by `requirePermission` in rbac.ts.
// ---------------------------------------------------------------------------

import { db, USER_COLUMNS, type AuthUser } from "./db";
import { normalizeEmail } from "./allowlist";
import { DEFAULT_ROLES, type UserOverrides } from "./permissions";

// ── Roles ───────────────────────────────────────────────────────────────────

export interface RoleRow {
  key: string;
  label: string;
  description: string | null;
  permissions: string[];
  rank: number;
  is_system: boolean;
}

export async function listRoles(): Promise<RoleRow[]> {
  const { data } = await db()
    .from("auth_roles")
    .select("key,label,description,permissions,rank,is_system")
    .order("rank", { ascending: true });
  const rows = (data as RoleRow[]) ?? [];
  if (rows.length) return rows;
  // Table empty (migration not applied yet) — fall back to the code defaults.
  return Object.entries(DEFAULT_ROLES).map(([key, permissions], i) => ({
    key,
    label: key[0].toUpperCase() + key.slice(1),
    description: null,
    permissions,
    rank: i * 10,
    is_system: true,
  }));
}

export async function getRole(key: string): Promise<RoleRow | null> {
  const { data } = await db()
    .from("auth_roles")
    .select("key,label,description,permissions,rank,is_system")
    .eq("key", key)
    .maybeSingle();
  if (data) return data as RoleRow;
  const fallback = DEFAULT_ROLES[key];
  return fallback
    ? {
        key,
        label: key,
        description: null,
        permissions: fallback,
        rank: 100,
        is_system: true,
      }
    : null;
}

export async function upsertRole(r: {
  key: string;
  label: string;
  description?: string | null;
  permissions: string[];
  rank?: number;
}): Promise<RoleRow> {
  const { data, error } = await db()
    .from("auth_roles")
    .upsert(
      {
        key: r.key,
        label: r.label,
        description: r.description ?? null,
        permissions: r.permissions,
        rank: r.rank ?? 100,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    )
    .select("key,label,description,permissions,rank,is_system")
    .single();
  if (error) throw error;
  return data as RoleRow;
}

export async function deleteRole(key: string): Promise<void> {
  const role = await getRole(key);
  if (!role) return;
  if (role.is_system) throw new Error("System roles cannot be deleted.");
  const { count } = await db()
    .from("auth_users")
    .select("id", { count: "exact", head: true })
    .eq("role", key);
  if ((count ?? 0) > 0) {
    throw new Error(`${count} user(s) still hold this role — reassign first.`);
  }
  await db().from("auth_roles").delete().eq("key", key);
}

// ── Users ───────────────────────────────────────────────────────────────────

export interface AdminUserRow extends AuthUser {
  passkey_count?: number;
}

export async function listUsers(opts: {
  q?: string;
  role?: string;
  status?: string;
  limit?: number;
} = {}): Promise<AdminUserRow[]> {
  let query = db()
    .from("auth_users")
    .select(USER_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 500);
  if (opts.role) query = query.eq("role", opts.role);
  if (opts.status) query = query.eq("status", opts.status);
  if (opts.q) {
    const term = `%${opts.q.replace(/[%,]/g, "")}%`;
    query = query.or(`email.ilike.${term},name.ilike.${term}`);
  }
  const { data } = await query;
  const users = (data as AdminUserRow[]) ?? [];

  // Attach passkey counts in one round-trip.
  const ids = users.map((u) => u.id);
  if (ids.length) {
    const { data: pk } = await db()
      .from("auth_passkeys")
      .select("user_id")
      .in("user_id", ids);
    const counts = new Map<string, number>();
    for (const row of (pk as { user_id: string }[]) ?? []) {
      counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1);
    }
    for (const u of users) u.passkey_count = counts.get(u.id) ?? 0;
  }
  return users;
}

export async function updateUser(
  id: string,
  patch: {
    name?: string | null;
    role?: string;
    status?: "active" | "invited" | "suspended";
    permissions?: UserOverrides;
    notes?: string | null;
  }
): Promise<AuthUser> {
  const { data, error } = await db()
    .from("auth_users")
    .update(patch)
    .eq("id", id)
    .select(USER_COLUMNS)
    .single();
  if (error) throw error;
  return data as AuthUser;
}

export async function deleteUser(id: string): Promise<void> {
  const { error } = await db().from("auth_users").delete().eq("id", id);
  if (error) throw error;
}

export async function countUsersWithRole(role: string): Promise<number> {
  const { count } = await db()
    .from("auth_users")
    .select("id", { count: "exact", head: true })
    .eq("role", role)
    .eq("status", "active");
  return count ?? 0;
}

// ── Invites ─────────────────────────────────────────────────────────────────

export interface InviteRow {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  sent_at: string | null;
  created_at: string;
}

const INVITE_COLUMNS =
  "id,email,name,role,expires_at,accepted_at,revoked_at,sent_at,created_at";

export async function createInvite(i: {
  email: string | null;
  name: string | null;
  role: string;
  tokenHash: string;
  expiresAt: string;
  createdBy: string | null;
}): Promise<InviteRow> {
  const { data, error } = await db()
    .from("auth_invites")
    .insert({
      email: i.email ? normalizeEmail(i.email) : null,
      name: i.name,
      role: i.role,
      token_hash: i.tokenHash,
      expires_at: i.expiresAt,
      created_by: i.createdBy,
    })
    .select(INVITE_COLUMNS)
    .single();
  if (error) throw error;
  return data as InviteRow;
}

export async function listInvites(): Promise<InviteRow[]> {
  const { data } = await db()
    .from("auth_invites")
    .select(INVITE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200);
  return (data as InviteRow[]) ?? [];
}

export async function markInviteSent(id: string): Promise<void> {
  await db()
    .from("auth_invites")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", id);
}

export async function revokeInvite(id: string): Promise<void> {
  await db()
    .from("auth_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("accepted_at", null);
}

export interface PendingInvite {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  expires_at: string;
}

/** Look up a live invite by token hash — not accepted, not revoked, not expired. */
export async function findLiveInvite(
  tokenHash: string
): Promise<PendingInvite | null> {
  const { data } = await db()
    .from("auth_invites")
    .select("id,email,name,role,expires_at")
    .eq("token_hash", tokenHash)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return (data as PendingInvite) ?? null;
}

/**
 * Atomically claim an invite. Returns null if it was already taken — call this
 * BEFORE creating the account, so a lost race never provisions a user.
 * Stamp the account afterwards with `setInviteAcceptedBy`.
 */
export async function acceptInvite(
  tokenHash: string
): Promise<PendingInvite | null> {
  const now = new Date().toISOString();
  const { data } = await db()
    .from("auth_invites")
    .update({ accepted_at: now })
    .eq("token_hash", tokenHash)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", now)
    .select("id,email,name,role,expires_at")
    .maybeSingle();
  return (data as PendingInvite) ?? null;
}

export async function setInviteAcceptedBy(
  id: string,
  userId: string
): Promise<void> {
  await db().from("auth_invites").update({ accepted_by: userId }).eq("id", id);
}

// ── Access codes ────────────────────────────────────────────────────────────

export interface AccessCodeRow {
  id: string;
  code: string;
  label: string | null;
  role: string;
  max_uses: number;
  uses: number;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

const CODE_COLUMNS =
  "id,code,label,role,max_uses,uses,expires_at,revoked_at,created_at";

export async function createAccessCode(c: {
  code: string;
  label: string | null;
  role: string;
  maxUses: number;
  expiresAt: string | null;
  createdBy: string | null;
}): Promise<AccessCodeRow> {
  const { data, error } = await db()
    .from("auth_access_codes")
    .insert({
      code: c.code,
      label: c.label,
      role: c.role,
      max_uses: c.maxUses,
      expires_at: c.expiresAt,
      created_by: c.createdBy,
    })
    .select(CODE_COLUMNS)
    .single();
  if (error) throw error;
  return data as AccessCodeRow;
}

export async function listAccessCodes(): Promise<AccessCodeRow[]> {
  const { data } = await db()
    .from("auth_access_codes")
    .select(CODE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200);
  return (data as AccessCodeRow[]) ?? [];
}

export async function revokeAccessCode(id: string): Promise<void> {
  await db()
    .from("auth_access_codes")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
}

export async function getAccessCodeByCode(
  code: string
): Promise<AccessCodeRow | null> {
  const { data } = await db()
    .from("auth_access_codes")
    .select(CODE_COLUMNS)
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();
  return (data as AccessCodeRow) ?? null;
}

/**
 * Claim one seat. Guarded by `uses = <observed>` so two concurrent redemptions
 * can't oversell the last seat (compare-and-swap, no transaction needed).
 */
export async function claimAccessCodeSeat(
  row: AccessCodeRow,
  email: string
): Promise<boolean> {
  const { data } = await db()
    .from("auth_access_codes")
    .update({ uses: row.uses + 1 })
    .eq("id", row.id)
    .eq("uses", row.uses)
    .is("revoked_at", null)
    .lt("uses", row.max_uses)
    .select("id")
    .maybeSingle();
  if (!data) return false;
  await db()
    .from("auth_access_code_uses")
    .insert({ code_id: row.id, email: normalizeEmail(email) });
  return true;
}

export async function listCodeUses(codeId: string) {
  const { data } = await db()
    .from("auth_access_code_uses")
    .select("email,used_at")
    .eq("code_id", codeId)
    .order("used_at", { ascending: false });
  return (data as { email: string; used_at: string }[]) ?? [];
}

// ── Waitlist ────────────────────────────────────────────────────────────────

export interface WaitlistRow {
  id: string;
  email: string;
  name: string | null;
  note: string | null;
  source: string | null;
  status: "pending" | "invited" | "rejected";
  created_at: string;
  reviewed_at: string | null;
}

const WAITLIST_COLUMNS =
  "id,email,name,note,source,status,created_at,reviewed_at";

export async function addToWaitlist(w: {
  email: string;
  name?: string | null;
  note?: string | null;
  source?: string | null;
}): Promise<void> {
  const { error } = await db()
    .from("auth_waitlist")
    .upsert(
      {
        email: normalizeEmail(w.email),
        name: w.name ?? null,
        note: w.note ?? null,
        source: w.source ?? null,
      },
      { onConflict: "email", ignoreDuplicates: true }
    );
  if (error) throw error;
}

export async function listWaitlist(status?: string): Promise<WaitlistRow[]> {
  let q = db()
    .from("auth_waitlist")
    .select(WAITLIST_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(500);
  if (status) q = q.eq("status", status);
  const { data } = await q;
  return (data as WaitlistRow[]) ?? [];
}

export async function getWaitlistEntry(id: string): Promise<WaitlistRow | null> {
  const { data } = await db()
    .from("auth_waitlist")
    .select(WAITLIST_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  return (data as WaitlistRow) ?? null;
}

export async function setWaitlistStatus(
  id: string,
  status: "pending" | "invited" | "rejected",
  reviewerId: string | null
): Promise<void> {
  await db()
    .from("auth_waitlist")
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewerId,
    })
    .eq("id", id);
}

export async function countWaitlistPending(): Promise<number> {
  const { count } = await db()
    .from("auth_waitlist")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return count ?? 0;
}

// ── Audit ───────────────────────────────────────────────────────────────────

export async function audit(entry: {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  target?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db().from("auth_audit_log").insert({
      actor_id: entry.actorId ?? null,
      actor_email: entry.actorEmail ?? null,
      action: entry.action,
      target: entry.target ?? null,
      meta: entry.meta ?? {},
    });
  } catch (e) {
    console.error("[auth] audit", e); // never fail the request over logging
  }
}

export async function listAudit(limit = 200) {
  const { data } = await db()
    .from("auth_audit_log")
    .select("id,actor_email,action,target,meta,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (
    (data as {
      id: string;
      actor_email: string | null;
      action: string;
      target: string | null;
      meta: Record<string, unknown>;
      created_at: string;
    }[]) ?? []
  );
}

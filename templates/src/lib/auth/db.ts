import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig, MAGIC_TTL_MIN } from "./config";
import { normalizeEmail } from "./allowlist";
import type { UserOverrides } from "./permissions";

let client: SupabaseClient | null = null;

/** Service-role client. Server-only — never import this into a client bundle. */
export function db(): SupabaseClient {
  if (!client) {
    const { url, serviceKey } = supabaseConfig();
    client = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export const USER_COLUMNS =
  "id,email,name,role,status,permissions,created_at,last_login_at,invited_at";

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  role?: string;
  status?: "active" | "invited" | "suspended";
  permissions?: UserOverrides | null;
  created_at?: string;
  last_login_at?: string | null;
  invited_at?: string | null;
}

export interface PasskeyRow {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  transports: string | null;
}

/** Non-secret passkey metadata — what the UI shows so people can tell them apart. */
export interface PasskeyInfo {
  id: string;
  user_id: string;
  label: string | null;
  device_type: "singleDevice" | "multiDevice" | null;
  backed_up: boolean;
  transports: string | null;
  created_at: string;
  last_used_at: string | null;
  /** null ⇒ self-enrolled; otherwise the admin who registered it. */
  created_by: string | null;
}

export const PASSKEY_INFO_COLUMNS =
  "id,user_id,label,device_type,backed_up,transports,created_at,last_used_at,created_by";

export async function getUserById(id: string): Promise<AuthUser | null> {
  const { data } = await db()
    .from("auth_users")
    .select(USER_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  return (data as AuthUser) ?? null;
}

export async function getUserByEmail(email: string): Promise<AuthUser | null> {
  const { data } = await db()
    .from("auth_users")
    .select(USER_COLUMNS)
    .eq("email", normalizeEmail(email))
    .maybeSingle();
  return (data as AuthUser) ?? null;
}

/**
 * Create-or-fetch a user. Only the fields you pass are written, so signing in
 * never clobbers a name or demotes a role set in the admin dashboard.
 */
export async function upsertUser(
  email: string,
  fields: {
    name?: string | null;
    role?: string;
    status?: "active" | "invited" | "suspended";
    invitedBy?: string | null;
  } = {}
): Promise<AuthUser> {
  const e = normalizeEmail(email);
  const payload: Record<string, unknown> = { email: e };
  if (fields.name !== undefined) payload.name = fields.name;
  if (fields.role !== undefined) payload.role = fields.role;
  if (fields.status !== undefined) payload.status = fields.status;
  if (fields.invitedBy !== undefined) {
    payload.invited_by = fields.invitedBy;
    payload.invited_at = new Date().toISOString();
  }

  const { data, error } = await db()
    .from("auth_users")
    .upsert(payload, { onConflict: "email" })
    .select(USER_COLUMNS)
    .single();
  if (error) throw error;
  return data as AuthUser;
}

export async function touchLogin(userId: string): Promise<void> {
  await db()
    .from("auth_users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", userId);
}

/** Flip an `invited` user to `active` once they actually complete a sign-in. */
export async function activateUser(userId: string): Promise<void> {
  await db()
    .from("auth_users")
    .update({ status: "active" })
    .eq("id", userId)
    .eq("status", "invited");
}

export async function createMagicLink(
  email: string,
  tokenHash: string
): Promise<void> {
  const expires = new Date(Date.now() + MAGIC_TTL_MIN * 60_000).toISOString();
  const { error } = await db().from("auth_magic_links").insert({
    email: normalizeEmail(email),
    token_hash: tokenHash,
    expires_at: expires,
  });
  if (error) throw error;
}

/** Atomically consume a valid link and return its email, or null. */
export async function consumeMagicLink(tokenHash: string): Promise<string | null> {
  const nowIso = new Date().toISOString();
  const { data } = await db()
    .from("auth_magic_links")
    .update({ consumed_at: nowIso })
    .eq("token_hash", tokenHash)
    .is("consumed_at", null)
    .gt("expires_at", nowIso)
    .select("email")
    .maybeSingle();
  return (data as { email: string } | null)?.email ?? null;
}

/** Count links issued to an email within the last `seconds` (rate limiting). */
export async function recentLinkCount(
  email: string,
  seconds: number
): Promise<number> {
  const since = new Date(Date.now() - seconds * 1000).toISOString();
  const { count } = await db()
    .from("auth_magic_links")
    .select("id", { count: "exact", head: true })
    .eq("email", normalizeEmail(email))
    .gt("created_at", since);
  return count ?? 0;
}

export async function listPasskeys(userId: string): Promise<PasskeyRow[]> {
  const { data } = await db()
    .from("auth_passkeys")
    .select("id,user_id,credential_id,public_key,counter,transports")
    .eq("user_id", userId);
  return (data as PasskeyRow[]) ?? [];
}

export async function countPasskeys(userId: string): Promise<number> {
  const { count } = await db()
    .from("auth_passkeys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return count ?? 0;
}

export async function getPasskeyByCredentialId(
  credentialId: string
): Promise<PasskeyRow | null> {
  const { data } = await db()
    .from("auth_passkeys")
    .select("id,user_id,credential_id,public_key,counter,transports")
    .eq("credential_id", credentialId)
    .maybeSingle();
  return (data as PasskeyRow) ?? null;
}

export async function createPasskey(p: {
  userId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string | null;
  label?: string | null;
  deviceType?: "singleDevice" | "multiDevice" | null;
  backedUp?: boolean;
  aaguid?: string | null;
  /** Admin who enrolled it on the user's behalf; omit for self-enrolment. */
  createdBy?: string | null;
}): Promise<void> {
  const { error } = await db().from("auth_passkeys").insert({
    user_id: p.userId,
    credential_id: p.credentialId,
    public_key: p.publicKey,
    counter: p.counter,
    transports: p.transports,
    label: p.label ?? null,
    device_type: p.deviceType ?? null,
    backed_up: p.backedUp ?? false,
    aaguid: p.aaguid ?? null,
    created_by: p.createdBy ?? null,
  });
  if (error) throw error;
}

/** Passkeys as shown in the account menu / admin modal — no key material. */
export async function listPasskeyInfo(userId: string): Promise<PasskeyInfo[]> {
  const { data } = await db()
    .from("auth_passkeys")
    .select(PASSKEY_INFO_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  return (data as PasskeyInfo[]) ?? [];
}

export async function getPasskeyInfo(id: string): Promise<PasskeyInfo | null> {
  const { data } = await db()
    .from("auth_passkeys")
    .select(PASSKEY_INFO_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  return (data as PasskeyInfo) ?? null;
}

/**
 * Delete one passkey. `userId` is a belt-and-braces scope so a self-service
 * route can never remove someone else's credential even with a guessed id.
 * Returns true if a row was removed.
 */
export async function deletePasskey(id: string, userId?: string): Promise<boolean> {
  let q = db().from("auth_passkeys").delete().eq("id", id);
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q.select("id");
  if (error) throw error;
  return ((data as { id: string }[]) ?? []).length > 0;
}

export async function updatePasskeyCounter(
  id: string,
  counter: number
): Promise<void> {
  await db()
    .from("auth_passkeys")
    .update({ counter, last_used_at: new Date().toISOString() })
    .eq("id", id);
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig, MAGIC_TTL_MIN } from "./config";
import { normalizeEmail } from "./allowlist";

let client: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (!client) {
    const { url, serviceKey } = supabaseConfig();
    client = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface PasskeyRow {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  transports: string | null;
}

export async function getUserById(id: string): Promise<AuthUser | null> {
  const { data } = await db()
    .from("auth_users")
    .select("id,email")
    .eq("id", id)
    .maybeSingle();
  return (data as AuthUser) ?? null;
}

export async function getUserByEmail(email: string): Promise<AuthUser | null> {
  const { data } = await db()
    .from("auth_users")
    .select("id,email")
    .eq("email", normalizeEmail(email))
    .maybeSingle();
  return (data as AuthUser) ?? null;
}

export async function upsertUser(email: string): Promise<AuthUser> {
  const e = normalizeEmail(email);
  const { data, error } = await db()
    .from("auth_users")
    .upsert({ email: e }, { onConflict: "email" })
    .select("id,email")
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
}): Promise<void> {
  const { error } = await db().from("auth_passkeys").insert({
    user_id: p.userId,
    credential_id: p.credentialId,
    public_key: p.publicKey,
    counter: p.counter,
    transports: p.transports,
  });
  if (error) throw error;
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

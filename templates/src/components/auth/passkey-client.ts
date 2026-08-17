"use client";

import { startRegistration, startAuthentication } from "@simplewebauthn/browser";

type Result = { ok: boolean; error?: string; label?: string };

export interface PasskeyInfo {
  id: string;
  label: string | null;
  device_type: "singleDevice" | "multiDevice" | null;
  backed_up: boolean;
  transports: string | null;
  created_at: string;
  last_used_at: string | null;
  created_by: string | null;
}

function errName(e: unknown): string {
  return (e as { name?: string })?.name ?? "";
}

/** One registration ceremony against a given options/verify endpoint pair. */
async function runRegistration(optionsUrl: string, verifyUrl: string): Promise<Result> {
  try {
    const optRes = await fetch(optionsUrl, { method: "POST" });
    if (!optRes.ok) {
      const j = await optRes.json().catch(() => ({}));
      return { ok: false, error: j.error ?? "Could not start passkey setup." };
    }
    const options = await optRes.json();
    const attResp = await startRegistration({ optionsJSON: options });
    const verRes = await fetch(verifyUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ response: attResp }),
    });
    const j = await verRes.json().catch(() => ({}));
    if (!verRes.ok) return { ok: false, error: j.error ?? "Could not save passkey." };
    return { ok: true, label: j.label };
  } catch (e) {
    const name = errName(e);
    if (name === "InvalidStateError")
      return { ok: false, error: "This device already has a passkey for this account." };
    if (name === "NotAllowedError")
      return { ok: false, error: "Passkey setup was cancelled." };
    return { ok: false, error: "Passkey setup failed on this device." };
  }
}

/** Register a passkey for the signed-in user. No nickname prompt — quick. Works for additional passkeys too. */
export function addPasskey(): Promise<Result> {
  return runRegistration(
    "/api/auth/passkey/register/options",
    "/api/auth/passkey/register/verify"
  );
}

/**
 * ADMIN: enrol a passkey for `userId` on THIS device (in-person setup / kiosk).
 * The credential is bound to that user — whoever holds this authenticator
 * signs in as them. Needs `users.passkeys`.
 */
export function enrollPasskeyForUser(userId: string): Promise<Result> {
  return runRegistration(
    `/api/admin/users/${userId}/passkeys/options`,
    `/api/admin/users/${userId}/passkeys/verify`
  );
}

/** The signed-in user's own passkeys. */
export async function listMyPasskeys(): Promise<PasskeyInfo[]> {
  const res = await fetch("/api/auth/passkeys", { cache: "no-store" });
  if (!res.ok) return [];
  const j = await res.json().catch(() => ({}));
  return (j.passkeys as PasskeyInfo[]) ?? [];
}

/** Remove one of the signed-in user's own passkeys. */
export async function removeMyPasskey(id: string): Promise<Result> {
  const res = await fetch(`/api/auth/passkeys/${id}`, { method: "DELETE" });
  if (res.ok) return { ok: true };
  const j = await res.json().catch(() => ({}));
  return { ok: false, error: j.error ?? "Could not remove the passkey." };
}

/** Usernameless passkey sign-in. */
export async function signInWithPasskey(): Promise<Result> {
  try {
    const optRes = await fetch("/api/auth/passkey/auth/options", {
      method: "POST",
    });
    if (!optRes.ok) return { ok: false, error: "Could not start passkey sign-in." };
    const options = await optRes.json();
    const asResp = await startAuthentication({ optionsJSON: options });
    const verRes = await fetch("/api/auth/passkey/auth/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ response: asResp }),
    });
    if (!verRes.ok) {
      const j = await verRes.json().catch(() => ({}));
      return { ok: false, error: j.error ?? "Passkey sign-in failed." };
    }
    return { ok: true };
  } catch (e) {
    if (errName(e) === "NotAllowedError")
      return { ok: false, error: "Passkey sign-in was cancelled." };
    return { ok: false, error: "No passkey found on this device." };
  }
}

/** Shared display helpers (client-safe). */
export function passkeyLabel(p: PasskeyInfo): string {
  return p.label ?? (p.device_type === "multiDevice" ? "Synced passkey" : "Passkey");
}

export function fmtPasskeyDate(iso: string | null | undefined): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

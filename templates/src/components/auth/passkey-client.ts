"use client";

import { startRegistration, startAuthentication } from "@simplewebauthn/browser";

type Result = { ok: boolean; error?: string };

function errName(e: unknown): string {
  return (e as { name?: string })?.name ?? "";
}

/** Register a passkey for the signed-in user. No nickname prompt — quick. */
export async function addPasskey(): Promise<Result> {
  try {
    const optRes = await fetch("/api/auth/passkey/register/options", {
      method: "POST",
    });
    if (!optRes.ok) {
      const j = await optRes.json().catch(() => ({}));
      return { ok: false, error: j.error ?? "Could not start passkey setup." };
    }
    const options = await optRes.json();
    const attResp = await startRegistration({ optionsJSON: options });
    const verRes = await fetch("/api/auth/passkey/register/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ response: attResp }),
    });
    if (!verRes.ok) {
      const j = await verRes.json().catch(() => ({}));
      return { ok: false, error: j.error ?? "Could not save passkey." };
    }
    return { ok: true };
  } catch (e) {
    const name = errName(e);
    if (name === "InvalidStateError")
      return { ok: false, error: "This device already has a passkey." };
    if (name === "NotAllowedError")
      return { ok: false, error: "Passkey setup was cancelled." };
    return { ok: false, error: "Passkey setup failed on this device." };
  }
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

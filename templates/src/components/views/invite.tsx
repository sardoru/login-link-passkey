"use client";

import { useState } from "react";
import { Loader2, ArrowRight, Mail, User, Check, XCircle } from "lucide-react";
import { AuthShell, Field, ErrorNote } from "./auth-shell";
import { BRAND } from "@/lib/auth/brand";

export function InviteView({
  token,
  valid,
  boundEmail,
  inviteeName,
  roleLabel,
  expiresAt,
}: {
  token: string;
  valid: boolean;
  boundEmail: string | null;
  inviteeName: string | null;
  roleLabel: string | null;
  expiresAt: string | null;
}) {
  const [name, setName] = useState(inviteeName ?? "");
  const [email, setEmail] = useState(boundEmail ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (!valid) {
    return (
      <AuthShell>
        <div className="animate-rise">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-negsoft text-neg">
            <XCircle className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold text-ink">Invitation unavailable</h1>
          <p className="mt-2 text-sm leading-relaxed text-inksoft">
            This invitation has expired, was already used, or has been revoked.
            Ask whoever invited you for a fresh link.
          </p>
          <a
            href="/login"
            className="mt-5 inline-block text-sm font-semibold text-brass hover:underline"
          >
            Go to sign in
          </a>
        </div>
      </AuthShell>
    );
  }

  if (sent) {
    return (
      <AuthShell>
        <div className="animate-rise">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-possoft text-pos">
            <Check className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold text-ink">Confirm your email</h1>
          <p className="mt-2 text-sm leading-relaxed text-inksoft">
            We sent a link to <span className="font-semibold text-ink">{email}</span>.
            Open it to finish setting up your account.
          </p>
        </div>
      </AuthShell>
    );
  }

  async function accept(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/invite/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, name, email }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? "Could not accept the invitation.");
        setBusy(false);
        return;
      }
      if (j.verify === "email") {
        setSent(true);
        setBusy(false);
        return;
      }
      window.location.assign(j.redirect ?? "/");
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  const expiryLabel = expiresAt
    ? new Date(expiresAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <AuthShell>
      <span className="mb-3 inline-block rounded-full border border-line px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-brass">
        Invitation
      </span>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        {inviteeName ? `Welcome, ${inviteeName.split(" ")[0]}` : `Welcome to ${BRAND.appName}`}
      </h1>
      <p className="mt-1.5 text-sm text-inksoft">
        You&apos;ve been invited to join {BRAND.appName}
        {roleLabel ? (
          <>
            {" "}as <span className="font-semibold text-ink">{roleLabel}</span>
          </>
        ) : null}
        . No password to choose — you&apos;ll use a secure link or a passkey.
      </p>

      {error && <ErrorNote>{error}</ErrorNote>}

      <form onSubmit={accept} className="mt-5">
        <Field
          label="Your name"
          icon={<User className="h-4 w-4" />}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Doe"
          autoComplete="name"
        />
        <Field
          label="Email address"
          icon={<Mail className="h-4 w-4" />}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          readOnly={Boolean(boundEmail)}
          disabled={Boolean(boundEmail)}
        />
        <button
          type="submit"
          disabled={busy}
          className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink text-sm font-semibold text-paper transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Accept invitation
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      {expiryLabel && (
        <p className="mt-3 text-center text-xs text-inkfaint">
          This invitation expires {expiryLabel}.
        </p>
      )}
    </AuthShell>
  );
}

"use client";

import { useState } from "react";
import { Loader2, ArrowRight, Mail, User, KeyRound, Check } from "lucide-react";
import { AuthShell, Field, ErrorNote } from "./auth-shell";
import { BRAND } from "@/lib/auth/brand";

/** /join — redeem an admin-issued access code (seat-limited, revocable). */
export function JoinView({ initialCode }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/access-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, email, name }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? "Could not redeem that code.");
        setBusy(false);
        return;
      }
      setSent(true);
    } catch {
      setError("Network error. Please try again.");
    }
    setBusy(false);
  }

  if (sent) {
    return (
      <AuthShell>
        <div className="animate-rise">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-possoft text-pos">
            <Check className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold text-ink">Code accepted</h1>
          <p className="mt-2 text-sm leading-relaxed text-inksoft">
            We sent a confirmation link to{" "}
            <span className="font-semibold text-ink">{email}</span>. Open it to
            finish creating your account.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <span className="mb-3 inline-block rounded-full border border-line px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-brass">
        Access code
      </span>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        Join {BRAND.appName}
      </h1>
      <p className="mt-1.5 text-sm text-inksoft">
        Enter the code you were given. We&apos;ll email you a link to confirm
        your address — no password needed.
      </p>

      {error && <ErrorNote>{error}</ErrorNote>}

      <form onSubmit={redeem} className="mt-5">
        <Field
          label="Access code"
          icon={<KeyRound className="h-4 w-4" />}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ACME-7K2P-QX9M"
          autoCapitalize="characters"
          spellCheck={false}
          style={{ fontFamily: "ui-monospace, monospace", letterSpacing: "0.08em" }}
        />
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
              Redeem code
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-inkfaint">
        Already have an account?{" "}
        <a href="/login" className="font-semibold text-brass hover:underline">
          Sign in
        </a>
      </p>
    </AuthShell>
  );
}

"use client";

import { useState } from "react";
import {
  Mail,
  Fingerprint,
  Check,
  Loader2,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { BrandMark } from "../brand-mark";
import { cx } from "../auth/cx";
import { signInWithPasskey } from "../auth/passkey-client";
import { BRAND } from "@/lib/auth/brand";

const ERRORS: Record<string, string> = {
  invalid: "That sign-in link was invalid. Request a new one below.",
  expired: "That link has expired or was already used. Request a new one.",
  server: "Something went wrong signing you in. Please try again.",
};

export function LoginView({
  initialError,
  next,
}: {
  initialError?: string;
  next?: string;
}) {
  const target = next && next.startsWith("/") ? next : "/";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(
    initialError ? (ERRORS[initialError] ?? null) : null
  );
  const [pkBusy, setPkBusy] = useState(false);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/auth/magic/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? "Could not send the link.");
        setStatus("idle");
        return;
      }
      setStatus("sent");
    } catch {
      setError("Network error. Please try again.");
      setStatus("idle");
    }
  }

  async function passkey() {
    setPkBusy(true);
    setError(null);
    const r = await signInWithPasskey();
    if (r.ok) {
      window.location.assign(target);
    } else {
      setError(r.error ?? "Passkey sign-in failed.");
      setPkBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-paper px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.6]"
        style={{
          background:
            "radial-gradient(620px 360px at 50% -8%, color-mix(in srgb, var(--brass) 16%, transparent), transparent 70%)",
        }}
      />
      <div className="relative w-full max-w-md">
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_18px_50px_-20px_rgba(0,0,0,0.35)]">
          <div className="rule-brass h-[3px]" />
          <div className="p-7 sm:p-9">
            <div className="mb-7 flex items-center gap-3">
              <BrandMark size={40} />
              <div className="leading-tight">
                <p className="text-lg font-bold tracking-tight text-ink">
                  {BRAND.appName.toUpperCase()}
                </p>
                <p className="text-[11px] font-medium uppercase tracking-wider text-inkfaint">
                  {BRAND.tagline}
                </p>
              </div>
            </div>

            {status === "sent" ? (
              <div className="animate-rise">
                <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-possoft text-pos">
                  <Check className="h-6 w-6" />
                </div>
                <h1 className="text-2xl font-semibold text-ink">
                  Check your inbox
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-inksoft">
                  We sent a secure sign-in link to{" "}
                  <span className="font-semibold text-ink">{email}</span>. It
                  expires in 15 minutes and can be used once.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setStatus("idle");
                    setEmail("");
                  }}
                  className="mt-5 text-sm font-semibold text-brass hover:underline"
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-semibold tracking-tight text-ink">
                  Sign in
                </h1>
                <p className="mt-1.5 text-sm text-inksoft">
                  Authorized users only. We&apos;ll email you a secure link — no
                  password needed.
                </p>

                {error && (
                  <div className="animate-rise mt-4 rounded-lg border border-neg/30 bg-negsoft px-3 py-2 text-sm text-neg">
                    {error}
                  </div>
                )}

                <form onSubmit={sendLink} className="mt-5">
                  <label className="mb-1.5 block text-sm font-medium text-ink">
                    Email address
                  </label>
                  <div className="flex h-11 items-center rounded-lg border border-line bg-paper focus-within:border-brass">
                    <Mail className="ml-3 h-4 w-4 text-inkfaint" />
                    <input
                      type="email"
                      autoComplete="email"
                      autoFocus
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="h-full w-full bg-transparent px-3 text-sm text-ink outline-none placeholder:text-inkfaint"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink text-sm font-semibold text-paper transition hover:opacity-90 disabled:opacity-60"
                  >
                    {status === "sending" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Email me a sign-in link
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>

                <div className="my-5 flex items-center gap-3">
                  <span className="h-px flex-1 bg-line" />
                  <span className="text-[11px] font-medium uppercase tracking-wide text-inkfaint">
                    or
                  </span>
                  <span className="h-px flex-1 bg-line" />
                </div>

                <button
                  type="button"
                  onClick={passkey}
                  disabled={pkBusy}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-line bg-surface text-sm font-semibold text-ink transition hover:bg-surface2 disabled:opacity-60"
                >
                  {pkBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin text-brass" />
                  ) : (
                    <Fingerprint className="h-4 w-4 text-brass" />
                  )}
                  Sign in with a passkey
                </button>
              </>
            )}
          </div>
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-inkfaint">
          <ShieldCheck className="h-3.5 w-3.5" />
          {BRAND.footerNote}
        </p>
      </div>
    </div>
  );
}

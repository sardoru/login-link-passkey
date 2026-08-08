"use client";

import { useState } from "react";
import { Loader2, ArrowRight, Mail, User, Check } from "lucide-react";
import { AuthShell, Field, ErrorNote } from "./auth-shell";
import { BRAND } from "@/lib/auth/brand";

/** /waitlist — public request-access form. Admin approves from /admin/waitlist. */
export function WaitlistView({ source }: { source?: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, name, note, company, source }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? "Could not add you to the list.");
        setBusy(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    }
    setBusy(false);
  }

  if (done) {
    return (
      <AuthShell>
        <div className="animate-rise">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-possoft text-pos">
            <Check className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold text-ink">You&apos;re on the list</h1>
          <p className="mt-2 text-sm leading-relaxed text-inksoft">
            Thanks — we&apos;ll email{" "}
            <span className="font-semibold text-ink">{email}</span> the moment a
            seat opens up. Nothing else to do for now.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <span className="mb-3 inline-block rounded-full border border-line px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-brass">
        Waitlist
      </span>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        Request access
      </h1>
      <p className="mt-1.5 text-sm text-inksoft">
        {BRAND.appName} is invite-only. Tell us who you are and we&apos;ll send
        an invitation when a seat opens.
      </p>

      {error && <ErrorNote>{error}</ErrorNote>}

      <form onSubmit={submit} className="mt-5">
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
        <label className="mb-3 block">
          <span className="mb-1.5 block text-sm font-medium text-ink">
            Why do you need access?{" "}
            <span className="font-normal text-inkfaint">(optional)</span>
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="A sentence is plenty."
            className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none placeholder:text-inkfaint focus:border-brass"
          />
        </label>

        {/* honeypot — hidden from humans, irresistible to bots */}
        <input
          type="text"
          name="company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute left-[-9999px] h-0 w-0 opacity-0"
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
              Join the waitlist
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-inkfaint">
        Have a code?{" "}
        <a href="/join" className="font-semibold text-brass hover:underline">
          Redeem it
        </a>{" "}
        ·{" "}
        <a href="/login" className="font-semibold text-brass hover:underline">
          Sign in
        </a>
      </p>
    </AuthShell>
  );
}

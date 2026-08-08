"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Fingerprint,
  LogOut,
  Check,
  ChevronDown,
  Loader2,
  Shield,
} from "lucide-react";
import { useAuth } from "./auth-context";
import { addPasskey } from "./passkey-client";
import { cx } from "./cx";

export function AccountMenu() {
  const { me, refresh } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!me?.authenticated) return null;
  const initial = (me.email ?? "?").charAt(0).toUpperCase();

  async function onAddPasskey() {
    setBusy(true);
    setMsg(null);
    const r = await addPasskey();
    setBusy(false);
    if (r.ok) {
      setMsg({ ok: true, text: "Passkey added" });
      await refresh();
    } else {
      setMsg({ ok: false, text: r.error ?? "Failed" });
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-line bg-surface py-1 pl-1 pr-2 transition-colors hover:bg-surface2"
      >
        <span className="grid h-7 w-7 place-items-center rounded-md bg-ink text-xs font-bold text-paper">
          {initial}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-inkfaint" />
      </button>

      {open && (
        <div className="animate-rise absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
          <div className="border-b border-line px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-inkfaint">
              Signed in as
            </p>
            <p className="truncate text-sm font-medium text-ink">
              {me.name ?? me.email}
            </p>
            {me.name && (
              <p className="truncate text-xs text-inksoft">{me.email}</p>
            )}
            {me.role && (
              <p className="mt-1 text-[11px] font-semibold capitalize text-brass">
                {me.role}
              </p>
            )}
          </div>

          <div className="p-1.5">
            {me.isAdmin && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink transition-colors hover:bg-surface2"
              >
                <Shield className="h-4 w-4 text-brass" />
                Admin dashboard
              </Link>
            )}
            {me.hasPasskey ? (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-pos">
                <Check className="h-4 w-4" />
                Passkey enabled
              </div>
            ) : (
              <button
                type="button"
                onClick={onAddPasskey}
                disabled={busy}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink transition-colors hover:bg-surface2 disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin text-brass" />
                ) : (
                  <Fingerprint className="h-4 w-4 text-brass" />
                )}
                Add a passkey
              </button>
            )}
            {msg && (
              <p
                className={cx(
                  "px-3 pb-1 pt-0.5 text-xs",
                  msg.ok ? "text-pos" : "text-neg"
                )}
              >
                {msg.text}
              </p>
            )}

            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-inksoft transition-colors hover:bg-surface2 hover:text-ink"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

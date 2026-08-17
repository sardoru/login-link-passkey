"use client";

import { useEffect, useState } from "react";
import { Fingerprint, X, Loader2, Check } from "lucide-react";
import { useAuth } from "./auth-context";
import { addPasskey } from "./passkey-client";

const DISMISS_KEY = "auth_pk_dismiss";
/** `?passkey=setup` (from an admin's setup-link email) forces the prompt open. */
const SETUP_PARAM = "passkey";

export function PasskeyPrompt() {
  const { me, refresh } = useAuth();
  const [dismissed, setDismissed] = useState(true);
  const [forced, setForced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    const sp = new URLSearchParams(window.location.search);
    if (sp.get(SETUP_PARAM) === "setup") setForced(true);
  }, []);

  if (!me?.authenticated || done) return null;
  if (!forced && (me.hasPasskey || dismissed)) return null;

  async function onAdd() {
    setBusy(true);
    setError(null);
    const r = await addPasskey();
    setBusy(false);
    if (r.ok) {
      setDone(true);
      clearSetupParam();
      await refresh();
    } else {
      setError(r.error ?? "Passkey setup failed.");
    }
  }

  function dismiss() {
    if (forced) {
      // Don't remember a dismissal that came from an admin nudge — just close.
      setForced(false);
      setDismissed(true);
      clearSetupParam();
      return;
    }
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  function clearSetupParam() {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has(SETUP_PARAM)) {
        url.searchParams.delete(SETUP_PARAM);
        window.history.replaceState({}, "", url.toString());
      }
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="animate-rise mb-5 overflow-hidden rounded-xl border border-brass/30 bg-gradient-to-r from-warnsoft to-surface">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brass/15 text-brass">
            <Fingerprint className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">
              {forced
                ? me.hasPasskey
                  ? "Add a passkey on this device"
                  : "Finish setting up your passkey"
                : "Sign in faster next time with a passkey"}
            </p>
            <p className="text-xs text-inksoft">
              {forced
                ? "Your admin sent you here — one tap saves a passkey for this device."
                : "Use Face ID or Touch ID instead of waiting for an email link."}
              {error && <span className="ml-1 text-neg">{error}</span>}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onAdd}
            disabled={busy}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-paper transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Fingerprint className="h-4 w-4" />
            )}
            Add passkey
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="grid h-9 w-9 place-items-center rounded-lg text-inkfaint hover:bg-surface2 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {done && (
        <div className="flex items-center gap-2 border-t border-brass/20 bg-possoft px-4 py-2 text-xs font-medium text-pos">
          <Check className="h-4 w-4" /> Passkey added — you can use it next time.
        </div>
      )}
    </div>
  );
}

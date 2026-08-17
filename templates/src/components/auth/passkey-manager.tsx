"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Fingerprint,
  Loader2,
  Plus,
  Trash2,
  X,
  Cloud,
  Smartphone,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "./auth-context";
import {
  addPasskey,
  listMyPasskeys,
  removeMyPasskey,
  passkeyLabel,
  fmtPasskeyDate,
  type PasskeyInfo,
} from "./passkey-client";
import { cx } from "./cx";

/**
 * Self-service passkey management: list every passkey on the account, add
 * another (no nickname prompt), remove one. Opened from <AccountMenu/>.
 * Styled with the auth tokens only — no dependency on the admin UI kit, so it
 * ships even in `--no-admin` installs.
 */
export function PasskeyManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Mount fresh on every open so state (list, notices) never leaks between sessions.
  if (!open) return null;
  return <PasskeyManagerDialog onClose={onClose} />;
}

function PasskeyManagerDialog({ onClose }: { onClose: () => void }) {
  const { refresh } = useAuth();
  const [items, setItems] = useState<PasskeyInfo[] | null>(null);
  const [busy, setBusy] = useState<string | "add" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setItems(await listMyPasskeys());
  }, []);

  useEffect(() => {
    let alive = true;
    listMyPasskeys().then((list) => {
      if (alive) setItems(list);
    });
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  async function onAdd() {
    setBusy("add");
    setMsg(null);
    const r = await addPasskey();
    setBusy(null);
    if (r.ok) {
      setMsg({ ok: true, text: `Passkey added${r.label ? ` — ${r.label}` : ""}.` });
      await Promise.all([load(), refresh()]);
    } else {
      setMsg({ ok: false, text: r.error ?? "Passkey setup failed." });
    }
  }

  async function onRemove(p: PasskeyInfo) {
    const last = (items?.length ?? 0) <= 1;
    const q = last
      ? `Remove "${passkeyLabel(p)}"? It's your only passkey — you'll sign in with an email link until you add another.`
      : `Remove "${passkeyLabel(p)}"? That device will need an email link to sign in again.`;
    if (!confirm(q)) return;
    setBusy(p.id);
    setMsg(null);
    const r = await removeMyPasskey(p.id);
    setBusy(null);
    if (r.ok) {
      setMsg({ ok: true, text: "Passkey removed." });
      await Promise.all([load(), refresh()]);
    } else {
      setMsg({ ok: false, text: r.error ?? "Could not remove the passkey." });
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-10"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="animate-rise w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brass/15 text-brass">
              <Fingerprint className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-ink">Your passkeys</h3>
              <p className="mt-0.5 text-sm text-inksoft">
                Each one lets a device sign in with Face ID, Touch ID, or Windows Hello.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-inkfaint transition hover:bg-surface2 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="px-5 py-4">
          {msg && (
            <div
              className={cx(
                "animate-rise mb-3 rounded-lg border px-3 py-2 text-sm",
                msg.ok
                  ? "border-pos/30 bg-possoft text-pos"
                  : "border-neg/30 bg-negsoft text-neg"
              )}
            >
              {msg.text}
            </div>
          )}

          {items === null ? (
            <div className="grid place-items-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-brass" />
            </div>
          ) : items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-inkfaint">
              No passkeys yet — you sign in with email links. Add one to skip the inbox next time.
            </p>
          ) : (
            <ul className="divide-y divide-line/60 rounded-xl border border-line">
              {items.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-3.5 py-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface2 text-inksoft">
                    {p.device_type === "multiDevice" ? (
                      <Cloud className="h-4 w-4" />
                    ) : (
                      <Smartphone className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium text-ink">
                      {passkeyLabel(p)}
                      {p.backed_up && (
                        <span
                          title="Synced across your devices (iCloud Keychain, Google Password Manager, 1Password…)"
                          className="inline-flex items-center gap-1 rounded-full border border-brass/40 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-brass"
                        >
                          <ShieldCheck className="h-3 w-3" /> synced
                        </span>
                      )}
                      {p.created_by && (
                        <span className="rounded-full border border-line bg-surface2 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-inksoft">
                          set up by admin
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-inkfaint">
                      Added {fmtPasskeyDate(p.created_at)} · Last used {fmtPasskeyDate(p.last_used_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(p)}
                    disabled={busy !== null}
                    aria-label={`Remove ${passkeyLabel(p)}`}
                    title="Remove this passkey"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-inkfaint transition hover:bg-negsoft hover:text-neg disabled:opacity-50"
                  >
                    {busy === p.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-inkfaint">
              Removing a passkey doesn&rsquo;t sign anyone out — it just stops that device from using Face ID next time.
            </p>
            <button
              type="button"
              onClick={onAdd}
              disabled={busy !== null}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-paper transition hover:opacity-90 disabled:opacity-60"
            >
              {busy === "add" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add {items && items.length > 0 ? "another" : "a"} passkey
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  Fingerprint,
  Trash2,
  Cloud,
  Smartphone,
  ShieldCheck,
  Send,
  Plus,
  UserCog,
} from "lucide-react";
import type { AdminUser } from "./types";
import {
  enrollPasskeyForUser,
  passkeyLabel,
  type PasskeyInfo,
} from "../auth/passkey-client";
import {
  Modal,
  Btn,
  Badge,
  Notice,
  EmptyState,
  Spinner,
  CopyButton,
  useJson,
  mutate,
  fmtDate,
} from "./ui";

interface Payload {
  user: { id: string; email: string; name: string | null; role: string };
  passkeys: PasskeyInfo[];
}

/**
 * Admin view of one user's passkeys: list + remove, plus two ways to add one —
 *   • "Add on this device"  → WebAuthn ceremony runs HERE, credential bound to
 *     the user (in-person setup, shared kiosks). Whoever holds this
 *     authenticator signs in as them, so it's gated by `users.passkeys` and the
 *     role-conferral rule.
 *   • "Email setup link"    → single-use magic link that signs the user in on
 *     THEIR device and opens the one-tap prompt. The only remote option:
 *     WebAuthn can't register a credential on a device you don't hold.
 */
export function PasskeysModal({
  user,
  self,
  canManage,
  onClose,
  onChanged,
}: {
  user: AdminUser;
  /** True when the admin is looking at their own row. */
  self: boolean;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data, loading, error, reload } = useJson<Payload>(
    `/api/admin/users/${user.id}/passkeys`
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "warn"; text: string } | null>(null);
  const [link, setLink] = useState<string | null>(null);

  const items = data?.passkeys ?? [];
  const who = user.name ?? user.email;

  async function remove(p: PasskeyInfo) {
    if (
      !confirm(
        `Remove "${passkeyLabel(p)}" from ${who}? That device will need an email link to sign in again.`
      )
    ) {
      return;
    }
    setBusy(p.id);
    setNotice(null);
    const r = await mutate(`/api/admin/users/${user.id}/passkeys/${p.id}`, "DELETE");
    setBusy(null);
    if (!r.ok) {
      setNotice({ tone: "error", text: r.error ?? "Could not remove the passkey." });
      return;
    }
    setNotice({ tone: "success", text: "Passkey removed." });
    await reload();
    onChanged();
  }

  async function addHere() {
    if (
      !self &&
      !confirm(
        `Register a passkey for ${who} on THIS device?\n\nWhoever uses this device's Face ID / Touch ID / PIN will sign in as ${who}. Use this only when they're with you (or for a shared kiosk).`
      )
    ) {
      return;
    }
    setBusy("add");
    setNotice(null);
    const r = await enrollPasskeyForUser(user.id);
    setBusy(null);
    if (!r.ok) {
      setNotice({ tone: "error", text: r.error ?? "Passkey setup failed." });
      return;
    }
    setNotice({ tone: "success", text: `Passkey added${r.label ? ` — ${r.label}` : ""}.` });
    await reload();
    onChanged();
  }

  async function sendLink() {
    setBusy("link");
    setNotice(null);
    setLink(null);
    const r = await mutate(`/api/admin/users/${user.id}/passkeys/setup-link`, "POST", {
      sendEmail: true,
    });
    setBusy(null);
    if (!r.ok) {
      setNotice({ tone: "error", text: r.error ?? "Could not create the setup link." });
      return;
    }
    setLink(String(r.data.url ?? ""));
    const warning = r.data.warning as string | undefined;
    setNotice(
      warning
        ? { tone: "warn", text: warning }
        : { tone: "success", text: `Setup link emailed to ${user.email}. Valid 15 minutes.` }
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Passkeys — ${who}`}
      description="Every device that can sign in to this account with Face ID, Touch ID, or Windows Hello."
    >
      <div className="space-y-3">
        {(error || notice) && (
          <Notice tone={notice?.tone ?? "error"}>{notice?.text ?? error}</Notice>
        )}

        {link && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-inkfaint">
              Setup link · single use · 15 min
            </p>
            <p className="break-all rounded-lg border border-line bg-paper px-3 py-2 font-mono text-xs text-inksoft">
              {link}
            </p>
            <div className="mt-2 flex justify-end">
              <CopyButton value={link} label="Copy link" />
            </div>
          </div>
        )}

        {loading && !data ? (
          <Spinner />
        ) : items.length === 0 ? (
          <EmptyState>
            No passkeys — {self ? "you sign" : `${who} signs`} in with email links.
          </EmptyState>
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
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-ink">
                    <span className="truncate">{passkeyLabel(p)}</span>
                    {p.backed_up && (
                      <Badge tone="brass">
                        <ShieldCheck className="mr-1 h-3 w-3" /> synced
                      </Badge>
                    )}
                    {p.created_by && (
                      <Badge tone="neutral">
                        <UserCog className="mr-1 h-3 w-3" /> admin-enrolled
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-inkfaint">
                    Added {fmtDate(p.created_at)} · Last used{" "}
                    {p.last_used_at ? fmtDate(p.last_used_at) : "never"}
                  </p>
                </div>
                {canManage && (
                  <Btn
                    variant="danger"
                    busy={busy === p.id}
                    disabled={busy !== null}
                    onClick={() => remove(p)}
                    title="Remove this passkey"
                    aria-label={`Remove ${passkeyLabel(p)}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Btn>
                )}
              </li>
            ))}
          </ul>
        )}

        {canManage && (
          <div className="rounded-xl border border-dashed border-line bg-paper/60 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-inkfaint">
              <Fingerprint className="h-3.5 w-3.5 text-brass" /> Add a passkey
            </p>
            <div className="flex flex-wrap gap-2">
              <Btn
                variant="primary"
                busy={busy === "add"}
                disabled={busy !== null || user.status === "suspended"}
                onClick={addHere}
                title={
                  self
                    ? "Register a passkey for your own account on this device"
                    : "Register on this device — for in-person setup or a shared kiosk"
                }
              >
                <Plus className="h-3.5 w-3.5" />
                {self ? "Add on this device" : "Add on this device (in person)"}
              </Btn>
              {!self && (
                <Btn
                  busy={busy === "link"}
                  disabled={busy !== null || user.status === "suspended"}
                  onClick={sendLink}
                  title="Email a single-use link that signs them in and opens the passkey prompt on their device"
                >
                  <Send className="h-3.5 w-3.5" />
                  Email setup link
                </Btn>
              )}
            </div>
            <p className="mt-2 text-xs text-inkfaint">
              {self
                ? "Adds a passkey for your account on this browser/device."
                : "A passkey only ever lives on the device that created it. If they're not with you, email the link — it lands on their device and opens the one-tap prompt."}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

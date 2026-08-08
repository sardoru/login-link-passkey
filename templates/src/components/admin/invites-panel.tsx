"use client";

import { useState } from "react";
import { Send, Link2, XCircle, RotateCw } from "lucide-react";
import type { Invite, Role } from "./types";
import {
  Panel,
  TableWrap,
  Btn,
  Input,
  Select,
  Labeled,
  Badge,
  Modal,
  Notice,
  EmptyState,
  Spinner,
  CopyButton,
  useJson,
  mutate,
  fmtDateTime,
} from "./ui";

/** Invites: email a branded welcome, or mint a shareable 3-day link. */
export function InvitesPanel({
  canWrite,
  canRevoke,
}: {
  canWrite: boolean;
  canRevoke: boolean;
}) {
  const { data, loading, error, reload } = useJson<{
    invites: Invite[];
    ttlDays: number;
  }>("/api/admin/invites");
  const roleData = useJson<{ roles: Role[] }>("/api/admin/roles");
  const [creating, setCreating] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const invites = data?.invites ?? [];
  const ttl = data?.ttlDays ?? 3;

  async function revoke(inv: Invite) {
    setBusyId(inv.id);
    setRowError(null);
    const r = await mutate("/api/admin/invites", "PATCH", {
      id: inv.id,
      action: "revoke",
    });
    setBusyId(null);
    if (!r.ok) setRowError(r.error ?? "Could not revoke.");
    await reload();
  }

  return (
    <>
      <Panel
        title="Invitations"
        description={`Single-use links that expire after ${ttl} days.`}
        actions={
          <>
            <Btn onClick={reload} aria-label="Refresh">
              <RotateCw className="h-3.5 w-3.5" />
            </Btn>
            {canWrite && (
              <Btn variant="primary" onClick={() => setCreating(true)}>
                <Send className="h-4 w-4" />
                New invite
              </Btn>
            )}
          </>
        }
      >
        {(error || rowError) && (
          <div className="px-5 pt-3">
            <Notice tone="error">{rowError ?? error}</Notice>
          </div>
        )}

        {loading && !data ? (
          <Spinner />
        ) : invites.length === 0 ? (
          <EmptyState>No invitations yet.</EmptyState>
        ) : (
          <TableWrap>
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-inkfaint">
                  <th className="px-5 py-2 font-semibold">Invitee</th>
                  <th className="px-3 py-2 font-semibold">Role</th>
                  <th className="px-3 py-2 font-semibold">State</th>
                  <th className="px-3 py-2 font-semibold">Expires</th>
                  <th className="px-5 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => (
                  <tr key={inv.id} className="border-b border-line/60 last:border-0">
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink">
                        {inv.email ?? (
                          <span className="text-inksoft">Open link</span>
                        )}
                      </p>
                      {inv.name && <p className="text-xs text-inksoft">{inv.name}</p>}
                    </td>
                    <td className="px-3 py-3 capitalize text-inksoft">{inv.role}</td>
                    <td className="px-3 py-3">
                      {inv.state === "pending" ? (
                        <Badge tone="warn">
                          {inv.sent_at ? "Sent" : "Link only"}
                        </Badge>
                      ) : inv.state === "accepted" ? (
                        <Badge tone="pos">Accepted</Badge>
                      ) : inv.state === "revoked" ? (
                        <Badge tone="neg">Revoked</Badge>
                      ) : (
                        <Badge>Expired</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3 text-inksoft">{fmtDateTime(inv.expires_at)}</td>
                    <td className="px-5 py-3 text-right">
                      {canRevoke && inv.state === "pending" && (
                        <Btn variant="danger" busy={busyId === inv.id} onClick={() => revoke(inv)}>
                          <XCircle className="h-3.5 w-3.5" />
                          Revoke
                        </Btn>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>

      {creating && (
        <NewInviteModal
          roles={roleData.data?.roles ?? []}
          ttl={ttl}
          onClose={() => setCreating(false)}
          onCreated={reload}
        />
      )}
    </>
  );
}

function NewInviteModal({
  roles,
  ttl,
  onClose,
  onCreated,
}: {
  roles: Role[];
  ttl: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [mode, setMode] = useState<"email" | "link">("email");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; emailed: boolean; warning?: string } | null>(
    null
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await mutate("/api/admin/invites", "POST", {
      name,
      email: mode === "email" ? email : "",
      role,
      sendEmail: mode === "email",
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? "Could not create the invite.");
      return;
    }
    setResult({
      url: String(r.data.url),
      emailed: Boolean(r.data.emailed),
      warning: r.data.warning as string | undefined,
    });
    onCreated();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={result ? "Invitation ready" : "New invitation"}
      description={result ? undefined : `The link works once and expires in ${ttl} days.`}
    >
      {result ? (
        <div className="space-y-3">
          <Notice tone={result.warning ? "warn" : "success"}>
            {result.warning ??
              (result.emailed
                ? `Invitation emailed to ${email}.`
                : "Link created — share it with the person you're inviting.")}
          </Notice>
          <p className="break-all rounded-lg border border-line bg-paper px-3 py-2 font-mono text-xs text-inksoft">
            {result.url}
          </p>
          <div className="flex justify-end gap-2">
            <CopyButton value={result.url} label="Copy link" />
            <Btn variant="primary" onClick={onClose}>
              Done
            </Btn>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          {error && <Notice tone="error">{error}</Notice>}

          <div className="flex overflow-hidden rounded-lg border border-line">
            {(
              [
                ["email", "Email an invite"],
                ["link", "Just make a link"],
              ] as const
            ).map(([k, label], i) => (
              <button
                key={k}
                type="button"
                onClick={() => setMode(k)}
                className={
                  "flex-1 px-3 py-2 text-sm font-semibold transition " +
                  (i > 0 ? "border-l border-line " : "") +
                  (mode === k ? "bg-ink text-paper" : "text-inksoft hover:bg-surface2")
                }
              >
                {label}
              </button>
            ))}
          </div>

          <Labeled label="Name" hint="Used in the email greeting and the link's preview card.">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </Labeled>

          {mode === "email" && (
            <Labeled label="Email address">
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
              />
            </Labeled>
          )}

          <Labeled label="Role">
            <Select value={role} onChange={(e) => setRole(e.target.value)}>
              {roles.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Labeled>

          {mode === "link" && (
            <Notice tone="warn">
              Anyone with this link can claim it. They&apos;ll confirm their email
              before the account activates.
            </Notice>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Btn type="button" onClick={onClose}>
              Cancel
            </Btn>
            <Btn type="submit" variant="primary" busy={busy}>
              {mode === "email" ? (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Send invitation
                </>
              ) : (
                <>
                  <Link2 className="h-3.5 w-3.5" />
                  Create link
                </>
              )}
            </Btn>
          </div>
        </form>
      )}
    </Modal>
  );
}

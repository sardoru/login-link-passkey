"use client";

import { useState } from "react";
import { KeyRound, Ban, RotateCw, Users } from "lucide-react";
import type { AccessCode, Role } from "./types";
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
  fmtDate,
} from "./ui";

const SEAT_PRESETS = [1, 5, 10, 25, 50, 100];

/**
 * Access codes — one shareable code that N people can sign up with, revocable
 * at any time. Seats default to 10; any number ≥ 1 works.
 */
export function AccessCodesPanel({
  canWrite,
  canRevoke,
}: {
  canWrite: boolean;
  canRevoke: boolean;
}) {
  const { data, loading, error, reload } = useJson<{
    codes: AccessCode[];
    defaultUses: number;
  }>("/api/admin/access-codes");
  const roleData = useJson<{ roles: Role[] }>("/api/admin/roles");
  const [creating, setCreating] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [usesFor, setUsesFor] = useState<AccessCode | null>(null);

  const codes = data?.codes ?? [];

  async function revoke(c: AccessCode) {
    if (!confirm(`Revoke ${c.code}? Unused seats stop working immediately.`)) return;
    setBusyId(c.id);
    setRowError(null);
    const r = await mutate("/api/admin/access-codes", "PATCH", {
      id: c.id,
      action: "revoke",
    });
    setBusyId(null);
    if (!r.ok) setRowError(r.error ?? "Could not revoke.");
    await reload();
  }

  return (
    <>
      <Panel
        title="Access codes"
        description="Multi-seat signup codes. Redeemers still verify their email before the account activates."
        actions={
          <>
            <Btn onClick={reload} aria-label="Refresh">
              <RotateCw className="h-3.5 w-3.5" />
            </Btn>
            {canWrite && (
              <Btn variant="primary" onClick={() => setCreating(true)}>
                <KeyRound className="h-4 w-4" />
                Generate code
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
        ) : codes.length === 0 ? (
          <EmptyState>No access codes yet.</EmptyState>
        ) : (
          <TableWrap>
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-inkfaint">
                  <th className="px-5 py-2 font-semibold">Code</th>
                  <th className="px-3 py-2 font-semibold">Role</th>
                  <th className="px-3 py-2 font-semibold">Seats</th>
                  <th className="px-3 py-2 font-semibold">State</th>
                  <th className="px-3 py-2 font-semibold">Expires</th>
                  <th className="px-5 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => {
                  const pct = Math.min(100, (c.uses / Math.max(1, c.max_uses)) * 100);
                  return (
                    <tr key={c.id} className="border-b border-line/60 last:border-0">
                      <td className="px-5 py-3">
                        <p className="font-mono text-sm font-semibold tracking-wider text-ink">
                          {c.code}
                        </p>
                        {c.label && <p className="text-xs text-inksoft">{c.label}</p>}
                      </td>
                      <td className="px-3 py-3 capitalize text-inksoft">{c.role}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="whitespace-nowrap tabular-nums text-inksoft">
                            {c.uses}/{c.max_uses}
                          </span>
                          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface3">
                            <span
                              className="block h-full rounded-full bg-brass"
                              style={{ width: `${pct}%` }}
                            />
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {c.status === "active" ? (
                          <Badge tone="pos">Active</Badge>
                        ) : c.status === "revoked" ? (
                          <Badge tone="neg">Revoked</Badge>
                        ) : c.status === "exhausted" ? (
                          <Badge tone="warn">Full</Badge>
                        ) : (
                          <Badge>Expired</Badge>
                        )}
                      </td>
                      <td className="px-3 py-3 text-inksoft">{fmtDate(c.expires_at)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Btn onClick={() => setUsesFor(c)} title="Who redeemed this">
                            <Users className="h-3.5 w-3.5" />
                            {c.uses}
                          </Btn>
                          <CopyButton value={c.joinUrl} label="Copy link" />
                          {canRevoke && !c.revoked_at && (
                            <Btn variant="danger" busy={busyId === c.id} onClick={() => revoke(c)}>
                              <Ban className="h-3.5 w-3.5" />
                              Revoke
                            </Btn>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>

      {creating && (
        <NewCodeModal
          roles={roleData.data?.roles ?? []}
          defaultUses={data?.defaultUses ?? 10}
          onClose={() => setCreating(false)}
          onCreated={reload}
        />
      )}

      {usesFor && <CodeUsesModal code={usesFor} onClose={() => setUsesFor(null)} />}
    </>
  );
}

function NewCodeModal({
  roles,
  defaultUses,
  onClose,
  onCreated,
}: {
  roles: Role[];
  defaultUses: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [label, setLabel] = useState("");
  const [role, setRole] = useState("member");
  const [maxUses, setMaxUses] = useState(String(defaultUses));
  const [expiresInDays, setExpiresInDays] = useState("30");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<AccessCode | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await mutate("/api/admin/access-codes", "POST", {
      label,
      role,
      maxUses: Number(maxUses),
      expiresInDays: expiresInDays ? Number(expiresInDays) : 0,
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? "Could not create the code.");
      return;
    }
    setCreated(r.data.code as AccessCode);
    onCreated();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={created ? "Code generated" : "Generate an access code"}
      description={
        created
          ? undefined
          : "Anyone with the code can claim a seat until it's full, expired, or revoked."
      }
    >
      {created ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-dashed border-line bg-paper px-4 py-5 text-center">
            <p className="font-mono text-2xl font-bold tracking-[0.2em] text-ink">
              {created.code}
            </p>
            <p className="mt-1 text-xs text-inkfaint">
              {created.max_uses} seat{created.max_uses === 1 ? "" : "s"} ·{" "}
              <span className="capitalize">{created.role}</span>
            </p>
          </div>
          <p className="break-all rounded-lg border border-line bg-paper px-3 py-2 font-mono text-xs text-inksoft">
            {created.joinUrl}
          </p>
          <div className="flex justify-end gap-2">
            <CopyButton value={created.code} label="Copy code" />
            <CopyButton value={created.joinUrl} label="Copy link" />
            <Btn variant="primary" onClick={onClose}>
              Done
            </Btn>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          {error && <Notice tone="error">{error}</Notice>}
          <Labeled label="Label" hint="For your reference — never shown to redeemers.">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Fall cohort"
            />
          </Labeled>
          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Role">
              <Select value={role} onChange={(e) => setRole(e.target.value)}>
                {roles.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Labeled>
            <Labeled label="Seats">
              <div className="flex gap-1.5">
                <Select
                  value={SEAT_PRESETS.includes(Number(maxUses)) ? maxUses : "custom"}
                  onChange={(e) => {
                    if (e.target.value !== "custom") setMaxUses(e.target.value);
                  }}
                >
                  {SEAT_PRESETS.map((n) => (
                    <option key={n} value={n}>
                      {n} invite{n === 1 ? "" : "s"}
                    </option>
                  ))}
                  <option value="custom">Custom…</option>
                </Select>
                <Input
                  type="number"
                  min={1}
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  className="w-20"
                  aria-label="Seat count"
                />
              </div>
            </Labeled>
          </div>
          <Labeled label="Expires in (days)" hint="Leave 0 for no expiry.">
            <Input
              type="number"
              min={0}
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
            />
          </Labeled>
          <div className="flex justify-end gap-2 pt-1">
            <Btn type="button" onClick={onClose}>
              Cancel
            </Btn>
            <Btn type="submit" variant="primary" busy={busy}>
              <KeyRound className="h-3.5 w-3.5" />
              Generate
            </Btn>
          </div>
        </form>
      )}
    </Modal>
  );
}

function CodeUsesModal({ code, onClose }: { code: AccessCode; onClose: () => void }) {
  const { data, loading } = useJson<{ uses: { email: string; used_at: string }[] }>(
    `/api/admin/access-codes?id=${code.id}`
  );
  return (
    <Modal open onClose={onClose} title={`Redemptions — ${code.code}`}>
      {loading ? (
        <Spinner />
      ) : !data?.uses.length ? (
        <p className="py-6 text-center text-sm text-inkfaint">
          Nobody has used this code yet.
        </p>
      ) : (
        <ul className="max-h-80 divide-y divide-line overflow-y-auto">
          {data.uses.map((u, i) => (
            <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="truncate text-ink">{u.email}</span>
              <span className="shrink-0 text-xs text-inkfaint">{fmtDate(u.used_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

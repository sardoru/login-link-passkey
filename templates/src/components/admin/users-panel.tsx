"use client";

import { useState } from "react";
import {
  UserPlus,
  Search,
  SlidersHorizontal,
  Trash2,
  Link2,
  Fingerprint,
  Ban,
  RotateCw,
} from "lucide-react";
import type { AdminUser, Role } from "./types";
import { PermissionMatrix } from "./permission-matrix";
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

interface Payload {
  users: AdminUser[];
  roles: Role[];
}

export function UsersPanel({ canWrite, canDelete, canEditPerms }: {
  canWrite: boolean;
  canDelete: boolean;
  canEditPerms: boolean;
}) {
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (roleFilter) query.set("role", roleFilter);
  if (statusFilter) query.set("status", statusFilter);

  const { data, loading, error, reload } = useJson<Payload>(
    `/api/admin/users?${query.toString()}`
  );
  const [adding, setAdding] = useState(false);
  const [permTarget, setPermTarget] = useState<AdminUser | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const roles = data?.roles ?? [];
  const users = data?.users ?? [];

  async function patch(u: AdminUser, body: Record<string, unknown>) {
    setBusyId(u.id);
    setRowError(null);
    const r = await mutate(`/api/admin/users/${u.id}`, "PATCH", body);
    setBusyId(null);
    if (!r.ok) setRowError(r.error ?? "Could not save.");
    await reload();
  }

  async function remove(u: AdminUser) {
    if (!confirm(`Delete ${u.email}? Their passkeys are removed too. This can't be undone.`)) {
      return;
    }
    setBusyId(u.id);
    setRowError(null);
    const r = await mutate(`/api/admin/users/${u.id}`, "DELETE");
    setBusyId(null);
    if (!r.ok) setRowError(r.error ?? "Could not delete.");
    await reload();
  }

  return (
    <>
      <Panel
        title="Users"
        description="Everyone with an account, their role, and their sign-in state."
        actions={
          canWrite ? (
            <Btn variant="primary" onClick={() => setAdding(true)}>
              <UserPlus className="h-4 w-4" />
              Add user
            </Btn>
          ) : null
        }
      >
        <div className="flex flex-wrap items-end gap-3 border-b border-line px-5 py-3">
          <div className="min-w-[200px] flex-1">
            <Labeled label="Search">
              <span className="relative block">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-inkfaint" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="name or email"
                  className="pl-8"
                />
              </span>
            </Labeled>
          </div>
          <div className="w-40">
            <Labeled label="Role">
              <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="">All roles</option>
                {roles.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Labeled>
          </div>
          <div className="w-40">
            <Labeled label="Status">
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Any status</option>
                <option value="active">Active</option>
                <option value="invited">Invited</option>
                <option value="suspended">Suspended</option>
              </Select>
            </Labeled>
          </div>
          <Btn onClick={reload} aria-label="Refresh">
            <RotateCw className="h-3.5 w-3.5" />
          </Btn>
        </div>

        {(error || rowError) && (
          <div className="px-5 pt-3">
            <Notice tone="error">{rowError ?? error}</Notice>
          </div>
        )}

        {loading && !data ? (
          <Spinner />
        ) : users.length === 0 ? (
          <EmptyState>No users match those filters.</EmptyState>
        ) : (
          <TableWrap>
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-inkfaint">
                  <th className="px-5 py-2 font-semibold">Person</th>
                  <th className="px-3 py-2 font-semibold">Role</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Last seen</th>
                  <th className="px-5 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const overrides =
                    (u.permissions?.grant?.length ?? 0) +
                    (u.permissions?.deny?.length ?? 0);
                  return (
                    <tr key={u.id} className="border-b border-line/60 last:border-0">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink text-xs font-bold text-paper">
                            {(u.name ?? u.email).charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink">
                              {u.name ?? "—"}
                              {u.passkey_count ? (
                                <Fingerprint className="ml-1.5 inline h-3.5 w-3.5 text-brass" />
                              ) : null}
                            </p>
                            <p className="truncate text-xs text-inksoft">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <Select
                            value={u.role}
                            disabled={!canWrite || busyId === u.id}
                            onChange={(e) => patch(u, { role: e.target.value })}
                            className="w-32"
                          >
                            {roles.map((r) => (
                              <option key={r.key} value={r.key}>
                                {r.label}
                              </option>
                            ))}
                          </Select>
                          {overrides > 0 && <Badge tone="brass">+{overrides}</Badge>}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {u.status === "active" ? (
                          <Badge tone="pos">Active</Badge>
                        ) : u.status === "invited" ? (
                          <Badge tone="warn">Invited</Badge>
                        ) : (
                          <Badge tone="neg">Suspended</Badge>
                        )}
                      </td>
                      <td className="px-3 py-3 text-inksoft">{fmtDate(u.last_login_at)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {canEditPerms && (
                            <Btn onClick={() => setPermTarget(u)} title="Edit permissions">
                              <SlidersHorizontal className="h-3.5 w-3.5" />
                              Permissions
                            </Btn>
                          )}
                          {canWrite && (
                            <Btn
                              busy={busyId === u.id}
                              onClick={() =>
                                patch(u, {
                                  status: u.status === "suspended" ? "active" : "suspended",
                                })
                              }
                              title={u.status === "suspended" ? "Restore access" : "Suspend"}
                            >
                              <Ban className="h-3.5 w-3.5" />
                              {u.status === "suspended" ? "Restore" : "Suspend"}
                            </Btn>
                          )}
                          {canDelete && (
                            <Btn variant="danger" onClick={() => remove(u)} title="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
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

      {adding && (
        <AddUserModal
          roles={roles}
          onClose={() => setAdding(false)}
          onCreated={reload}
        />
      )}

      <Modal
        open={Boolean(permTarget)}
        onClose={() => setPermTarget(null)}
        wide
        title={`Permissions — ${permTarget?.name ?? permTarget?.email ?? ""}`}
        description="Grant or deny individual capabilities on top of the role."
      >
        {permTarget && (
          <PermissionMatrix
            user={permTarget}
            roles={roles}
            onSaved={reload}
            onClose={() => setPermTarget(null)}
          />
        )}
      </Modal>
    </>
  );
}

function AddUserModal({
  roles,
  onClose,
  onCreated,
}: {
  roles: Role[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [sendEmail, setSendEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; emailed: boolean; warning?: string } | null>(
    null
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await mutate("/api/admin/users", "POST", { name, email, role, sendEmail });
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? "Could not add the user.");
      return;
    }
    const invite = r.data.invite as { url: string; emailed: boolean };
    setResult({
      url: invite.url,
      emailed: invite.emailed,
      warning: r.data.warning as string | undefined,
    });
    onCreated();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={result ? "User added" : "Add a user"}
      description={
        result
          ? undefined
          : "Creates the account and mints a 3-day invitation. The welcome email goes out through Resend."
      }
    >
      {result ? (
        <div className="space-y-3">
          <Notice tone={result.warning ? "warn" : "success"}>
            {result.warning ??
              (result.emailed
                ? `Welcome email sent to ${email}.`
                : "User added. Share the invitation link below.")}
          </Notice>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-inkfaint">
              Invitation link · expires in 3 days
            </p>
            <p className="break-all rounded-lg border border-line bg-paper px-3 py-2 font-mono text-xs text-inksoft">
              {result.url}
            </p>
          </div>
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
          <Labeled label="Full name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </Labeled>
          <Labeled label="Email address">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
            />
          </Labeled>
          <Labeled label="Role">
            <Select value={role} onChange={(e) => setRole(e.target.value)}>
              {roles.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Labeled>
          <label className="flex items-center gap-2 text-sm text-inksoft">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="h-4 w-4 accent-[var(--brass)]"
            />
            Send the welcome email now
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Btn type="button" onClick={onClose}>
              Cancel
            </Btn>
            <Btn type="submit" variant="primary" busy={busy}>
              <Link2 className="h-3.5 w-3.5" />
              Add &amp; invite
            </Btn>
          </div>
        </form>
      )}
    </Modal>
  );
}

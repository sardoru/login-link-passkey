"use client";

import { useEffect, useState } from "react";
import { Plus, Save, Trash2, AlertTriangle, Lock } from "lucide-react";
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  WILDCARD,
} from "@/lib/auth/permissions";
import type { Role } from "./types";
import {
  Panel,
  TableWrap,
  Btn,
  Input,
  Labeled,
  Modal,
  Notice,
  Spinner,
  useJson,
  mutate,
} from "./ui";
import { cx } from "../auth/cx";

/**
 * The role × permission grid. Roles are columns, capabilities are rows; click a
 * cell to toggle. Changes are staged locally and saved per column, so you can
 * rework a whole role before committing it.
 */
export function RolesPanel({ canWrite }: { canWrite: boolean }) {
  const { data, loading, error, reload } = useJson<{ roles: Role[] }>(
    "/api/admin/roles"
  );
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const roles = data?.roles ?? [];

  useEffect(() => {
    if (!data) return;
    setDraft(Object.fromEntries(roles.map((r) => [r.key, [...r.permissions]])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  function toggle(roleKey: string, permKey: string) {
    setDraft((d) => {
      const current = d[roleKey] ?? [];
      if (current.includes(WILDCARD)) return d; // owner-style role: not editable cell-by-cell
      return {
        ...d,
        [roleKey]: current.includes(permKey)
          ? current.filter((k) => k !== permKey)
          : [...current, permKey],
      };
    });
  }

  function isDirty(r: Role) {
    const a = [...(draft[r.key] ?? [])].sort().join(",");
    const b = [...r.permissions].sort().join(",");
    return a !== b;
  }

  async function save(r: Role) {
    setBusy(r.key);
    setRowError(null);
    const res = await mutate("/api/admin/roles", "PUT", {
      key: r.key,
      label: r.label,
      description: r.description,
      permissions: draft[r.key] ?? [],
      rank: r.rank,
    });
    setBusy(null);
    if (!res.ok) setRowError(res.error ?? "Could not save the role.");
    await reload();
  }

  async function remove(r: Role) {
    if (!confirm(`Delete the "${r.label}" role?`)) return;
    setBusy(r.key);
    setRowError(null);
    const res = await mutate(`/api/admin/roles?key=${encodeURIComponent(r.key)}`, "DELETE");
    setBusy(null);
    if (!res.ok) setRowError(res.error ?? "Could not delete the role.");
    await reload();
  }

  return (
    <>
      <Panel
        title="Roles"
        description="Click a cell to grant or revoke. Each role saves independently."
        actions={
          canWrite ? (
            <Btn variant="primary" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              New role
            </Btn>
          ) : null
        }
      >
        {(error || rowError) && (
          <div className="px-5 pt-3">
            <Notice tone="error">{rowError ?? error}</Notice>
          </div>
        )}

        {loading && !data ? (
          <Spinner />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="sticky left-0 z-10 bg-surface px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-inkfaint">
                    Capability
                  </th>
                  {roles.map((r) => (
                    <th key={r.key} className="px-3 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="flex items-center gap-1 text-sm font-semibold text-ink">
                          {r.is_system && <Lock className="h-3 w-3 text-inkfaint" />}
                          {r.label}
                        </span>
                        <span className="font-mono text-[10px] text-inkfaint">{r.key}</span>
                        {canWrite && (
                          <span className="flex gap-1">
                            <Btn
                              busy={busy === r.key}
                              disabled={!isDirty(r)}
                              variant={isDirty(r) ? "primary" : "ghost"}
                              onClick={() => save(r)}
                              className="h-7 px-2 text-xs"
                            >
                              <Save className="h-3 w-3" />
                              Save
                            </Btn>
                            {!r.is_system && (
                              <Btn
                                variant="ghost"
                                onClick={() => remove(r)}
                                className="h-7 px-1.5"
                                aria-label={`Delete ${r.label}`}
                              >
                                <Trash2 className="h-3 w-3 text-neg" />
                              </Btn>
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_GROUPS.map((group) => (
                  <RoleGroup
                    key={group}
                    group={group}
                    roles={roles}
                    draft={draft}
                    canWrite={canWrite}
                    onToggle={toggle}
                  />
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>

      {creating && (
        <NewRoleModal onClose={() => setCreating(false)} onCreated={reload} />
      )}
    </>
  );
}

function RoleGroup({
  group,
  roles,
  draft,
  canWrite,
  onToggle,
}: {
  group: string;
  roles: Role[];
  draft: Record<string, string[]>;
  canWrite: boolean;
  onToggle: (roleKey: string, permKey: string) => void;
}) {
  return (
    <>
      <tr className="bg-surface2/60">
        <td
          colSpan={roles.length + 1}
          className="sticky left-0 px-5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-inkfaint"
        >
          {group}
        </td>
      </tr>
      {PERMISSIONS.filter((p) => p.group === group).map((perm) => (
        <tr key={perm.key} className="border-b border-line/60 last:border-0">
          <td className="sticky left-0 z-10 bg-surface px-5 py-2.5">
            <p className="flex items-center gap-1.5 font-medium text-ink">
              {perm.label}
              {perm.sensitive && <AlertTriangle className="h-3.5 w-3.5 text-warn" />}
            </p>
            <p className="font-mono text-[11px] text-inkfaint">{perm.key}</p>
          </td>
          {roles.map((r) => {
            const perms = draft[r.key] ?? [];
            const all = perms.includes(WILDCARD);
            const on = all || perms.includes(perm.key);
            return (
              <td key={r.key} className="px-3 py-2.5 text-center">
                <button
                  type="button"
                  disabled={!canWrite || all}
                  onClick={() => onToggle(r.key, perm.key)}
                  aria-pressed={on}
                  aria-label={`${perm.label} for ${r.label}`}
                  title={all ? "This role holds every permission (*)" : undefined}
                  className={cx(
                    "h-6 w-6 rounded-md border transition",
                    on
                      ? "border-pos/40 bg-pos text-paper"
                      : "border-line bg-paper hover:border-brass",
                    (!canWrite || all) && "cursor-not-allowed opacity-70"
                  )}
                >
                  {on ? "✓" : ""}
                </button>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

function NewRoleModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await mutate("/api/admin/roles", "PUT", {
      key,
      label: label.trim(),
      description,
      permissions: ["app.access"],
      rank: 60,
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? "Could not create the role.");
      return;
    }
    onCreated();
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New role"
      description="Starts with app access only — grant the rest in the grid."
    >
      <form onSubmit={submit} className="space-y-3">
        {error && <Notice tone="error">{error}</Notice>}
        <Labeled label="Name" hint={key ? `key: ${key}` : undefined}>
          <Input
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Front desk"
          />
        </Labeled>
        <Labeled label="Description">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this role is for"
          />
        </Labeled>
        <div className="flex justify-end gap-2 pt-1">
          <Btn type="button" onClick={onClose}>
            Cancel
          </Btn>
          <Btn type="submit" variant="primary" busy={busy} disabled={!key}>
            Create role
          </Btn>
        </div>
      </form>
    </Modal>
  );
}

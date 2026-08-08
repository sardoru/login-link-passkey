"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  permissionSource,
  effectivePermissions,
  type PermissionSource,
} from "@/lib/auth/permissions";
import type { AdminUser, Role, UserOverrides } from "./types";
import { Btn, Notice, mutate } from "./ui";
import { cx } from "../auth/cx";

/**
 * Per-user permission editor. Every capability is tri-state against the role:
 *
 *   Inherit — follow the role (the default; tracks future role edits)
 *   Grant   — add this capability for this person only
 *   Deny    — remove it for this person only, even if the role has it
 *
 * Only the deltas are stored, so editing a role still moves everyone who
 * inherits it.
 */
export function PermissionMatrix({
  user,
  roles,
  onSaved,
  onClose,
}: {
  user: AdminUser;
  roles: Role[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const rolePerms = useMemo(
    () => roles.find((r) => r.key === user.role)?.permissions ?? [],
    [roles, user.role]
  );
  const [overrides, setOverrides] = useState<UserOverrides>({
    grant: user.permissions?.grant ?? [],
    deny: user.permissions?.deny ?? [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effective = effectivePermissions(rolePerms, overrides);
  const dirty =
    JSON.stringify({
      g: [...(overrides.grant ?? [])].sort(),
      d: [...(overrides.deny ?? [])].sort(),
    }) !==
    JSON.stringify({
      g: [...(user.permissions?.grant ?? [])].sort(),
      d: [...(user.permissions?.deny ?? [])].sort(),
    });

  function setCell(key: string, next: "inherit" | "grant" | "deny") {
    setOverrides((o) => {
      const grant = new Set(o.grant ?? []);
      const deny = new Set(o.deny ?? []);
      grant.delete(key);
      deny.delete(key);
      if (next === "grant") grant.add(key);
      if (next === "deny") deny.add(key);
      return { grant: [...grant], deny: [...deny] };
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    const r = await mutate(`/api/admin/users/${user.id}`, "PATCH", {
      permissions: overrides,
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? "Could not save.");
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface2 px-3 py-2 text-sm">
        <span className="text-inksoft">
          Role{" "}
          <span className="font-semibold capitalize text-ink">
            {roles.find((r) => r.key === user.role)?.label ?? user.role}
          </span>{" "}
          grants {rolePerms.includes("*") ? "everything" : `${rolePerms.length} of ${PERMISSIONS.length}`}
        </span>
        <span className="text-inksoft">
          Effective:{" "}
          <span className="font-semibold text-ink">
            {effective.length}/{PERMISSIONS.length}
          </span>
        </span>
      </div>

      {error && (
        <div className="mb-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      <div className="max-h-[52vh] space-y-4 overflow-y-auto pr-1">
        {PERMISSION_GROUPS.map((group) => (
          <div key={group}>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-inkfaint">
              {group}
            </p>
            <div className="overflow-hidden rounded-lg border border-line">
              {PERMISSIONS.filter((p) => p.group === group).map((perm, i) => {
                const source = permissionSource(perm.key, rolePerms, overrides);
                const state: "inherit" | "grant" | "deny" =
                  source === "granted" ? "grant" : source === "denied" ? "deny" : "inherit";
                return (
                  <div
                    key={perm.key}
                    className={cx(
                      "flex flex-wrap items-center justify-between gap-3 px-3 py-2.5",
                      i > 0 && "border-t border-line"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                        {perm.label}
                        {perm.sensitive && (
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warn" />
                        )}
                      </p>
                      <p className="truncate font-mono text-[11px] text-inkfaint">
                        {perm.key}
                      </p>
                    </div>
                    <TriState
                      value={state}
                      inheritedOn={source === "role"}
                      onChange={(v) => setCell(perm.key, v)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between gap-2">
        <Btn
          type="button"
          variant="ghost"
          onClick={() => setOverrides({ grant: [], deny: [] })}
          disabled={!(overrides.grant?.length || overrides.deny?.length)}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset to role
        </Btn>
        <div className="flex gap-2">
          <Btn type="button" onClick={onClose}>
            Cancel
          </Btn>
          <Btn type="button" variant="primary" busy={busy} disabled={!dirty} onClick={save}>
            Save permissions
          </Btn>
        </div>
      </div>
    </div>
  );
}

function TriState({
  value,
  inheritedOn,
  onChange,
}: {
  value: "inherit" | "grant" | "deny";
  inheritedOn: boolean;
  onChange: (v: "inherit" | "grant" | "deny") => void;
}) {
  const options: { key: "inherit" | "grant" | "deny"; label: string; on: string }[] = [
    {
      key: "inherit",
      label: inheritedOn ? "Inherit ✓" : "Inherit",
      on: "bg-surface3 text-ink",
    },
    { key: "grant", label: "Grant", on: "bg-possoft text-pos" },
    { key: "deny", label: "Deny", on: "bg-negsoft text-neg" },
  ];
  return (
    <div className="flex shrink-0 overflow-hidden rounded-lg border border-line">
      {options.map((o, i) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          aria-pressed={value === o.key}
          className={cx(
            "px-2.5 py-1.5 text-xs font-semibold transition",
            i > 0 && "border-l border-line",
            value === o.key ? o.on : "text-inkfaint hover:bg-surface2 hover:text-inksoft"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

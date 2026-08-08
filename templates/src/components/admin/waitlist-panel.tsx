"use client";

import { useState } from "react";
import { Check, X, RotateCw } from "lucide-react";
import type { Role, WaitlistEntry } from "./types";
import {
  Panel,
  TableWrap,
  Btn,
  Select,
  Badge,
  Notice,
  EmptyState,
  Spinner,
  useJson,
  mutate,
  fmtDate,
} from "./ui";
import { cx } from "../auth/cx";

const FILTERS = [
  ["pending", "Pending"],
  ["invited", "Invited"],
  ["rejected", "Rejected"],
  ["", "All"],
] as const;

/** Waitlist review — approving creates the account and emails a 3-day invite. */
export function WaitlistPanel({ canApprove }: { canApprove: boolean }) {
  const [filter, setFilter] = useState<string>("pending");
  const { data, loading, error, reload } = useJson<{ entries: WaitlistEntry[] }>(
    `/api/admin/waitlist${filter ? `?status=${filter}` : ""}`
  );
  const roleData = useJson<{ roles: Role[] }>("/api/admin/roles");
  const [role, setRole] = useState("member");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const entries = data?.entries ?? [];

  async function act(entry: WaitlistEntry, action: "approve" | "reject") {
    setBusyId(entry.id);
    setRowError(null);
    setNotice(null);
    const r = await mutate("/api/admin/waitlist", "PATCH", {
      id: entry.id,
      action,
      role,
    });
    setBusyId(null);
    if (!r.ok) {
      setRowError(r.error ?? "Could not update.");
    } else if (action === "approve") {
      setNotice(
        (r.data.warning as string) ?? `Invitation emailed to ${entry.email}.`
      );
    }
    await reload();
  }

  return (
    <Panel
      title="Waitlist"
      description="People who requested access. Approving sends them an invitation."
      actions={
        <>
          <div className="flex overflow-hidden rounded-lg border border-line">
            {FILTERS.map(([key, label], i) => (
              <button
                key={label}
                type="button"
                onClick={() => setFilter(key)}
                className={cx(
                  "px-2.5 py-1.5 text-xs font-semibold transition",
                  i > 0 && "border-l border-line",
                  filter === key ? "bg-ink text-paper" : "text-inksoft hover:bg-surface2"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Btn onClick={reload} aria-label="Refresh">
            <RotateCw className="h-3.5 w-3.5" />
          </Btn>
        </>
      }
    >
      {canApprove && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface2/50 px-5 py-2.5 text-sm">
          <span className="text-inksoft">Approve into role:</span>
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-40"
          >
            {(roleData.data?.roles ?? []).map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </Select>
        </div>
      )}

      {(error || rowError || notice) && (
        <div className="px-5 pt-3">
          <Notice tone={rowError || error ? "error" : "success"}>
            {rowError ?? error ?? notice}
          </Notice>
        </div>
      )}

      {loading && !data ? (
        <Spinner />
      ) : entries.length === 0 ? (
        <EmptyState>Nobody is waiting right now.</EmptyState>
      ) : (
        <TableWrap>
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-inkfaint">
                <th className="px-5 py-2 font-semibold">Person</th>
                <th className="px-3 py-2 font-semibold">Reason</th>
                <th className="px-3 py-2 font-semibold">Requested</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-5 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-line/60 last:border-0">
                  <td className="px-5 py-3">
                    <p className="font-medium text-ink">{e.name ?? "—"}</p>
                    <p className="text-xs text-inksoft">{e.email}</p>
                  </td>
                  <td className="max-w-xs px-3 py-3 text-inksoft">
                    <p className="line-clamp-2">{e.note ?? "—"}</p>
                  </td>
                  <td className="px-3 py-3 text-inksoft">{fmtDate(e.created_at)}</td>
                  <td className="px-3 py-3">
                    {e.status === "pending" ? (
                      <Badge tone="warn">Pending</Badge>
                    ) : e.status === "invited" ? (
                      <Badge tone="pos">Invited</Badge>
                    ) : (
                      <Badge tone="neg">Rejected</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {canApprove && e.status === "pending" && (
                      <div className="flex items-center justify-end gap-1.5">
                        <Btn
                          variant="primary"
                          busy={busyId === e.id}
                          onClick={() => act(e, "approve")}
                        >
                          <Check className="h-3.5 w-3.5" />
                          Approve
                        </Btn>
                        <Btn variant="danger" onClick={() => act(e, "reject")}>
                          <X className="h-3.5 w-3.5" />
                        </Btn>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </Panel>
  );
}

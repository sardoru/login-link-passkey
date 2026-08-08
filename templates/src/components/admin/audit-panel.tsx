"use client";

import { RotateCw } from "lucide-react";
import {
  Panel,
  TableWrap,
  Btn,
  Badge,
  Notice,
  EmptyState,
  Spinner,
  useJson,
  fmtDateTime,
} from "./ui";

interface Entry {
  id: string;
  actor_email: string | null;
  action: string;
  target: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

/** Append-only trail of every admin action. Read-only by design. */
export function AuditPanel() {
  const { data, loading, error, reload } = useJson<{ entries: Entry[] }>(
    "/api/admin/audit"
  );
  const entries = data?.entries ?? [];

  return (
    <Panel
      title="Audit log"
      description="The last 200 administrative changes."
      actions={
        <Btn onClick={reload} aria-label="Refresh">
          <RotateCw className="h-3.5 w-3.5" />
        </Btn>
      }
    >
      {error && (
        <div className="px-5 pt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      {loading && !data ? (
        <Spinner />
      ) : entries.length === 0 ? (
        <EmptyState>Nothing logged yet.</EmptyState>
      ) : (
        <TableWrap>
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-inkfaint">
                <th className="px-5 py-2 font-semibold">When</th>
                <th className="px-3 py-2 font-semibold">Actor</th>
                <th className="px-3 py-2 font-semibold">Action</th>
                <th className="px-5 py-2 font-semibold">Target</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-line/60 last:border-0">
                  <td className="whitespace-nowrap px-5 py-2.5 text-inksoft">
                    {fmtDateTime(e.created_at)}
                  </td>
                  <td className="px-3 py-2.5 text-inksoft">{e.actor_email ?? "system"}</td>
                  <td className="px-3 py-2.5">
                    <Badge tone={e.action.includes("delete") || e.action.includes("revoke") ? "neg" : "neutral"}>
                      {e.action}
                    </Badge>
                  </td>
                  <td className="px-5 py-2.5 text-ink">{e.target ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </Panel>
  );
}

import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/rbac";
import { listAudit } from "@/lib/auth/admin-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const g = await requirePermission("audit.read");
  if (!g.ok) return g.response;
  return NextResponse.json({ entries: await listAudit(200) });
}

import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/rbac";
import { listRoles, upsertRole, deleteRole, audit } from "@/lib/auth/admin-db";
import {
  PERMISSIONS,
  sanitizeRolePermissions,
  can,
} from "@/lib/auth/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/roles — the matrix: roles × the permission catalog. */
export async function GET() {
  const g = await requirePermission("roles.read");
  if (!g.ok) return g.response;
  return NextResponse.json({
    roles: await listRoles(),
    permissions: PERMISSIONS,
  });
}

/**
 * PUT /api/admin/roles — create or update a role.
 * body: { key, label, description?, permissions: string[], rank? }
 */
export async function PUT(req: NextRequest) {
  const g = await requirePermission("roles.write");
  if (!g.ok) return g.response;
  const { actor } = g;

  const body = await req.json().catch(() => ({}));
  const key = String(body?.key ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  const label = String(body?.label ?? "").trim() || key;
  if (!key) {
    return NextResponse.json(
      { error: "A role key is required (letters, numbers, - and _)." },
      { status: 400 }
    );
  }

  const permissions = sanitizeRolePermissions(body?.permissions);
  // No privilege escalation: you can't mint a role stronger than yourself.
  if (actor.user.role !== "owner") {
    const escalates = permissions.filter((k) => !can(actor.perms, k));
    if (permissions.includes("*") || escalates.length) {
      return NextResponse.json(
        { error: "You can't grant permissions you don't hold.", escalates },
        { status: 403 }
      );
    }
  }

  try {
    const role = await upsertRole({
      key,
      label,
      description: body?.description ? String(body.description) : null,
      permissions,
      rank: Number.isFinite(body?.rank) ? Number(body.rank) : 100,
    });
    await audit({
      actorId: actor.user.id,
      actorEmail: actor.user.email,
      action: "role.saved",
      target: key,
      meta: { permissions },
    });
    return NextResponse.json({ ok: true, role });
  } catch (e) {
    console.error("[admin] roles PUT", e);
    return NextResponse.json({ error: "Could not save the role." }, { status: 500 });
  }
}

/** DELETE /api/admin/roles?key=… — only custom roles with no members. */
export async function DELETE(req: NextRequest) {
  const g = await requirePermission("roles.write");
  if (!g.ok) return g.response;
  const key = req.nextUrl.searchParams.get("key") ?? "";
  try {
    await deleteRole(key);
    await audit({
      actorId: g.actor.user.id,
      actorEmail: g.actor.user.email,
      action: "role.deleted",
      target: key,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not delete the role." },
      { status: 400 }
    );
  }
}

import { NextResponse, type NextRequest } from "next/server";
import {
  requirePermission,
  canConferRole,
  canConferPermissions,
  blocksLastOwner,
} from "@/lib/auth/rbac";
import { updateUser, deleteUser, audit } from "@/lib/auth/admin-db";
import { getUserById } from "@/lib/auth/db";
import { sanitizeOverrides } from "@/lib/auth/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/users/[id]
 * body: { name?, role?, status?, permissions?: {grant:[],deny:[]} }
 * Permission overrides need `users.permissions`; everything else `users.write`.
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const wantsOverrides = body?.permissions !== undefined;
  const g = await requirePermission(
    ...(wantsOverrides ? ["users.permissions"] : ["users.write"])
  );
  if (!g.ok) return g.response;
  const { actor } = g;

  const target = await getUserById(id);
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const patch: Parameters<typeof updateUser>[1] = {};
  if (body?.name !== undefined) patch.name = String(body.name).trim() || null;
  if (body?.notes !== undefined) patch.notes = String(body.notes).trim() || null;

  if (body?.role !== undefined) {
    const role = String(body.role);
    if (!(await canConferRole(actor, role))) {
      return NextResponse.json(
        { error: "You can't assign a role with permissions you don't hold." },
        { status: 403 }
      );
    }
    patch.role = role;
  }

  if (body?.status !== undefined) {
    const status = String(body.status);
    if (!["active", "invited", "suspended"].includes(status)) {
      return NextResponse.json({ error: "Unknown status." }, { status: 400 });
    }
    patch.status = status as "active" | "invited" | "suspended";
  }

  if (wantsOverrides) {
    const overrides = sanitizeOverrides(body.permissions);
    if (!canConferPermissions(actor, overrides)) {
      return NextResponse.json(
        { error: "You can't grant a permission you don't hold." },
        { status: 403 }
      );
    }
    patch.permissions = overrides;
  }

  // Guard rails: don't strand the account, don't orphan the tenancy.
  if (target.id === actor.user.id && (patch.role || patch.status)) {
    return NextResponse.json(
      { error: "You can't change your own role or status." },
      { status: 400 }
    );
  }
  if (await blocksLastOwner(target, patch)) {
    return NextResponse.json(
      { error: "This is the last active owner — promote someone else first." },
      { status: 400 }
    );
  }

  try {
    const user = await updateUser(id, patch);
    await audit({
      actorId: actor.user.id,
      actorEmail: actor.user.email,
      action: "user.updated",
      target: target.email,
      meta: patch as Record<string, unknown>,
    });
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    console.error("[admin] users PATCH", e);
    return NextResponse.json({ error: "Could not save the user." }, { status: 500 });
  }
}

/** DELETE /api/admin/users/[id] — removes the account and its passkeys. */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const g = await requirePermission("users.delete");
  if (!g.ok) return g.response;
  const { actor } = g;

  const target = await getUserById(id);
  if (!target) return NextResponse.json({ ok: true });
  if (target.id === actor.user.id) {
    return NextResponse.json(
      { error: "You can't delete your own account." },
      { status: 400 }
    );
  }
  if (await blocksLastOwner(target, "delete")) {
    return NextResponse.json(
      { error: "This is the last active owner — promote someone else first." },
      { status: 400 }
    );
  }

  try {
    await deleteUser(id);
    await audit({
      actorId: actor.user.id,
      actorEmail: actor.user.email,
      action: "user.deleted",
      target: target.email,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin] users DELETE", e);
    return NextResponse.json({ error: "Could not delete the user." }, { status: 500 });
  }
}

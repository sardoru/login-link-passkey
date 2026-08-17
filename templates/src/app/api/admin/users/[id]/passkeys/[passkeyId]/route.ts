import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/rbac";
import { deletePasskey, getPasskeyInfo } from "@/lib/auth/db";
import { audit } from "@/lib/auth/admin-db";
import { passkeyTarget } from "@/lib/auth/passkey-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; passkeyId: string }> };

/** DELETE /api/admin/users/[id]/passkeys/[passkeyId] — remove one passkey. */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id, passkeyId } = await ctx.params;
  const g = await requirePermission("users.passkeys");
  if (!g.ok) return g.response;
  const { actor } = g;

  const t = await passkeyTarget(actor, id);
  if (!t.ok) return t.response;

  const pk = await getPasskeyInfo(passkeyId);
  if (!pk || pk.user_id !== id) {
    return NextResponse.json({ error: "Passkey not found." }, { status: 404 });
  }

  try {
    await deletePasskey(passkeyId, id);
    await audit({
      actorId: actor.user.id,
      actorEmail: actor.user.email,
      action: "passkey.deleted",
      target: t.target.email,
      meta: { passkeyId, label: pk.label },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin] passkeys DELETE", e);
    return NextResponse.json({ error: "Could not remove the passkey." }, { status: 500 });
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/server";
import { deletePasskey } from "@/lib/auth/db";
import { audit } from "@/lib/auth/admin-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * DELETE /api/auth/passkeys/[id] — remove one of your OWN passkeys.
 * Scoped by user_id, so a guessed id can never touch someone else's credential.
 * Removing the last one is allowed: the magic link always remains as a way in.
 */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await ctx.params;

  try {
    const removed = await deletePasskey(id, session.sub);
    if (!removed) return NextResponse.json({ error: "Passkey not found." }, { status: 404 });
    await audit({
      actorId: session.sub,
      actorEmail: session.email,
      action: "passkey.self_deleted",
      target: session.email,
      meta: { passkeyId: id },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[auth] passkeys DELETE", e);
    return NextResponse.json({ error: "Could not remove the passkey." }, { status: 500 });
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/rbac";
import { finishRegistration } from "@/lib/auth/passkey-registration";
import { passkeyTarget } from "@/lib/auth/passkey-admin";
import { verifyChallenge } from "@/lib/auth/session";
import { challengeCookieOptions } from "@/lib/auth/server";
import { CHALLENGE_COOKIE_REG } from "@/lib/auth/config";
import { audit } from "@/lib/auth/admin-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/admin/users/[id]/passkeys/verify — finish the on-behalf enrolment. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const g = await requirePermission("users.passkeys");
  if (!g.ok) return g.response;
  const { actor } = g;

  const t = await passkeyTarget(actor, id, { forEnrol: true });
  if (!t.ok) return t.response;

  const body = await req.json().catch(() => null);
  if (!body?.response)
    return NextResponse.json({ error: "Missing response" }, { status: 400 });

  const payload = await verifyChallenge(
    req.cookies.get(CHALLENGE_COOKIE_REG)?.value
  );
  // Must be the challenge minted by /options for THIS target by THIS admin.
  if (!payload || payload.sub !== t.target.id || payload.by !== actor.user.id)
    return NextResponse.json({ error: "Challenge expired — try again." }, { status: 400 });

  let label = "";
  try {
    ({ label } = await finishRegistration({
      req,
      response: body.response,
      expectedChallenge: String(payload.ch),
      userId: t.target.id,
      createdBy: actor.user.id,
    }));
  } catch (e) {
    console.error("[admin] passkeys/verify", e);
    return NextResponse.json({ error: "Could not verify passkey." }, { status: 400 });
  }

  await audit({
    actorId: actor.user.id,
    actorEmail: actor.user.email,
    action: "passkey.enrolled",
    target: t.target.email,
    meta: { label },
  });

  const res = NextResponse.json({ ok: true, label });
  res.cookies.set(CHALLENGE_COOKIE_REG, "", {
    ...challengeCookieOptions(0),
    maxAge: 0,
  });
  return res;
}

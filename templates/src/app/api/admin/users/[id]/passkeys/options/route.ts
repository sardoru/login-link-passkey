import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/rbac";
import { registrationOptionsFor } from "@/lib/auth/passkey-registration";
import { passkeyTarget } from "@/lib/auth/passkey-admin";
import { signChallenge } from "@/lib/auth/session";
import { challengeCookieOptions } from "@/lib/auth/server";
import { CHALLENGE_COOKIE_REG } from "@/lib/auth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/users/[id]/passkeys/options — begin enrolling a passkey for
 * this user ON THE ADMIN'S CURRENT DEVICE. Meant for in-person setup (hand the
 * phone over, they do Face ID) or shared kiosks. The credential is bound to
 * the target user, so whoever holds this authenticator signs in as them.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const g = await requirePermission("users.passkeys");
  if (!g.ok) return g.response;
  const { actor } = g;

  const t = await passkeyTarget(actor, id, { forEnrol: true });
  if (!t.ok) return t.response;

  const options = await registrationOptionsFor(req, t.target);
  const challenge = await signChallenge(
    { ch: options.challenge, sub: t.target.id, by: actor.user.id },
    300
  );
  const res = NextResponse.json(options);
  res.cookies.set(CHALLENGE_COOKIE_REG, challenge, challengeCookieOptions());
  return res;
}

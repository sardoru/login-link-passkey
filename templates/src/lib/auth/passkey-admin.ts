// ---------------------------------------------------------------------------
// Guards for admin passkey management (/api/admin/users/[id]/passkeys/*).
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { canConferRole, type Actor } from "./rbac";
import { getUserById, type AuthUser } from "./db";

export type TargetGuard =
  | { ok: true; target: AuthUser }
  | { ok: false; response: NextResponse };

/**
 * Resolve the target user and apply the anti-escalation rule for passkeys:
 * enrolling a passkey on someone's behalf mints a credential that signs in AS
 * them, so you may only do it for people whose role you could confer yourself
 * (or for your own account). Owners bypass, as everywhere else.
 */
export async function passkeyTarget(
  actor: Actor,
  userId: string,
  opts: { forEnrol?: boolean } = {}
): Promise<TargetGuard> {
  const target = await getUserById(userId);
  if (!target) {
    return {
      ok: false,
      response: NextResponse.json({ error: "User not found." }, { status: 404 }),
    };
  }
  const isSelf = target.id === actor.user.id;
  if (!isSelf && !(await canConferRole(actor, target.role ?? "member"))) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "You can't manage passkeys for a role above your own." },
        { status: 403 }
      ),
    };
  }
  if (opts.forEnrol && target.status === "suspended") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Restore this account before adding a passkey." },
        { status: 400 }
      ),
    };
  }
  return { ok: true, target };
}

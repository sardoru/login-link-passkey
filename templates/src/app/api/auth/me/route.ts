import { NextResponse } from "next/server";
import { countPasskeys } from "@/lib/auth/db";
import { currentActor, sessionPayloadFor } from "@/lib/auth/rbac";
import { signSession } from "@/lib/auth/session";
import { sessionCookieOptions } from "@/lib/auth/server";
import { SESSION_COOKIE } from "@/lib/auth/config";
import { can } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Live identity. Permissions are re-read from the database on every call, and
 * the session cookie is re-signed whenever it has drifted — so a role change in
 * the admin dashboard takes effect on the user's next page load, with no
 * sign-out required.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ authenticated: false });

  const actor = await currentActor();
  if (!actor) {
    // Deleted or suspended mid-session — drop the cookie.
    const res = NextResponse.json({ authenticated: false });
    res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(0), maxAge: 0 });
    return res;
  }

  let hasPasskey = false;
  try {
    hasPasskey = (await countPasskeys(actor.user.id)) > 0;
  } catch {
    /* ignore */
  }

  const res = NextResponse.json({
    authenticated: true,
    id: actor.user.id,
    email: actor.user.email,
    name: actor.user.name ?? null,
    role: actor.user.role ?? "member",
    permissions: actor.perms,
    isAdmin: can(actor.perms, "admin.access"),
    hasPasskey,
  });

  const stale =
    session.role !== actor.user.role ||
    (session.perms ?? []).join(",") !== actor.perms.join(",") ||
    (session.name ?? "") !== (actor.user.name ?? "");
  if (stale) {
    const jwt = await signSession(await sessionPayloadFor(actor.user));
    res.cookies.set(SESSION_COOKIE, jwt, sessionCookieOptions());
  }
  return res;
}

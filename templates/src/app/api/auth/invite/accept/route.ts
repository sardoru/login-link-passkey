import { NextResponse } from "next/server";
import {
  findLiveInvite,
  acceptInvite,
  setInviteAcceptedBy,
  audit,
} from "@/lib/auth/admin-db";
import { upsertUser, touchLogin, createMagicLink } from "@/lib/auth/db";
import { hashToken } from "@/lib/auth/invites";
import { generateMagicToken } from "@/lib/auth/tokens";
import { sendMagicLinkEmail } from "@/lib/auth/email";
import { signSession } from "@/lib/auth/session";
import { sessionCookieOptions } from "@/lib/auth/server";
import { sessionPayloadFor } from "@/lib/auth/rbac";
import { SESSION_COOKIE, SITE_URL } from "@/lib/auth/config";
import { normalizeEmail, isValidEmail } from "@/lib/auth/allowlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/invite/accept — body: { token, name?, email? }
 *
 * Bound invite (created with an email): delivery to that inbox already proves
 * the address, so accepting signs the person straight in.
 * Open invite (no email): we take the address they type and verify it with a
 * magic link before any session exists.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = String(body?.token ?? "");
  const name = String(body?.name ?? "").trim() || null;
  const typedEmail = String(body?.email ?? "").trim();

  if (!token) {
    return NextResponse.json({ error: "Missing invitation." }, { status: 400 });
  }

  const tokenHash = hashToken(token);
  const invite = await findLiveInvite(tokenHash);
  if (!invite) {
    return NextResponse.json(
      { error: "This invitation has expired, been used, or was revoked." },
      { status: 410 }
    );
  }

  const email = invite.email ?? normalizeEmail(typedEmail);
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  try {
    // Claim first: if we lose the race on an open link, no account is created.
    const claimed = await acceptInvite(tokenHash);
    if (!claimed) {
      return NextResponse.json(
        { error: "This invitation was just used." },
        { status: 410 }
      );
    }

    const user = await upsertUser(email, {
      name: name ?? invite.name,
      role: invite.role,
      status: invite.email ? "active" : "invited",
    });
    await setInviteAcceptedBy(claimed.id, user.id);

    await audit({
      actorEmail: email,
      action: "invite.accepted",
      target: email,
      meta: { role: invite.role, bound: Boolean(invite.email) },
    });

    // Open link — verify the typed address before issuing a session.
    if (!invite.email) {
      const { token: mt, tokenHash: mh } = generateMagicToken();
      await createMagicLink(email, mh);
      await sendMagicLinkEmail(email, `${SITE_URL}/api/auth/magic/verify?token=${mt}`);
      return NextResponse.json({ ok: true, verify: "email", email });
    }

    await touchLogin(user.id);
    const jwt = await signSession(await sessionPayloadFor(user));
    const res = NextResponse.json({ ok: true, verify: "none", redirect: "/" });
    res.cookies.set(SESSION_COOKIE, jwt, sessionCookieOptions());
    return res;
  } catch (e) {
    console.error("[auth] invite/accept", e);
    return NextResponse.json(
      { error: "Could not accept the invitation. Please try again." },
      { status: 500 }
    );
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { requirePermission, canConferRole } from "@/lib/auth/rbac";
import {
  createInvite,
  listInvites,
  listRoles,
  revokeInvite,
  markInviteSent,
  audit,
} from "@/lib/auth/admin-db";
import { normalizeEmail, isValidEmail } from "@/lib/auth/allowlist";
import {
  generateInviteToken,
  inviteExpiry,
  inviteUrl,
  inviteState,
} from "@/lib/auth/invites";
import { sendInviteEmail } from "@/lib/auth/email-invite";
import { INVITE_TTL_DAYS } from "@/lib/auth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/invites — every invite with a computed state. */
export async function GET() {
  const g = await requirePermission("invites.read");
  if (!g.ok) return g.response;
  const invites = await listInvites();
  return NextResponse.json({
    invites: invites.map((i) => ({ ...i, state: inviteState(i) })),
    ttlDays: INVITE_TTL_DAYS,
  });
}

/**
 * POST /api/admin/invites — mint a 3-day invite link.
 * body: { email?, name?, role?, sendEmail?: boolean }
 *
 * With an email: the link is bound to that address and accepting signs them in
 * directly (the address is proven by delivery). Without one: an open link —
 * whoever opens it supplies their email and gets a magic link to verify it.
 */
export async function POST(req: NextRequest) {
  const g = await requirePermission("invites.write");
  if (!g.ok) return g.response;
  const { actor } = g;

  const body = await req.json().catch(() => ({}));
  const rawEmail = String(body?.email ?? "").trim();
  const email = rawEmail ? normalizeEmail(rawEmail) : null;
  const name = String(body?.name ?? "").trim() || null;
  const role = String(body?.role ?? "member");
  const sendEmail = body?.sendEmail !== false && !!email;

  if (email && !isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!(await canConferRole(actor, role))) {
    return NextResponse.json(
      { error: "You can't invite someone to a role with permissions you don't hold." },
      { status: 403 }
    );
  }

  try {
    const { token, tokenHash } = generateInviteToken();
    const invite = await createInvite({
      email,
      name,
      role,
      tokenHash,
      expiresAt: inviteExpiry(),
      createdBy: actor.user.id,
    });
    const url = inviteUrl(token);

    let emailed = false;
    if (sendEmail && email) {
      try {
        const roles = await listRoles();
        await sendInviteEmail({
          to: email,
          url,
          name,
          inviterName: actor.user.name ?? null,
          roleLabel: roles.find((r) => r.key === role)?.label ?? role,
        });
        await markInviteSent(invite.id);
        emailed = true;
      } catch (e) {
        console.error("[admin] invite email", e);
      }
    }

    await audit({
      actorId: actor.user.id,
      actorEmail: actor.user.email,
      action: "invite.created",
      target: email ?? "(open link)",
      meta: { role, emailed, expiresAt: invite.expires_at },
    });

    // The raw token is returned exactly once — only its hash is stored.
    return NextResponse.json({
      ok: true,
      invite: { ...invite, state: inviteState(invite) },
      url,
      emailed,
      warning:
        sendEmail && !emailed
          ? "Invite created — the email failed to send. Copy the link instead."
          : undefined,
    });
  } catch (e) {
    console.error("[admin] invites POST", e);
    return NextResponse.json({ error: "Could not create the invite." }, { status: 500 });
  }
}

/** PATCH /api/admin/invites — body: { id, action: "revoke" }. */
export async function PATCH(req: NextRequest) {
  const g = await requirePermission("invites.revoke");
  if (!g.ok) return g.response;
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "");
  if (!id) return NextResponse.json({ error: "Missing invite id." }, { status: 400 });

  await revokeInvite(id);
  await audit({
    actorId: g.actor.user.id,
    actorEmail: g.actor.user.email,
    action: "invite.revoked",
    target: id,
  });
  return NextResponse.json({ ok: true });
}

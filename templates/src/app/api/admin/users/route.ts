import { NextResponse, type NextRequest } from "next/server";
import { requirePermission, canConferRole } from "@/lib/auth/rbac";
import { listUsers, listRoles, createInvite, audit, markInviteSent } from "@/lib/auth/admin-db";
import { getUserByEmail, upsertUser } from "@/lib/auth/db";
import { normalizeEmail, isValidEmail } from "@/lib/auth/allowlist";
import {
  generateInviteToken,
  inviteExpiry,
  inviteUrl,
} from "@/lib/auth/invites";
import { sendInviteEmail } from "@/lib/auth/email-invite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/users?q=&role=&status= — user list plus the role catalog. */
export async function GET(req: NextRequest) {
  const g = await requirePermission("users.read");
  if (!g.ok) return g.response;

  const sp = req.nextUrl.searchParams;
  const [users, roles] = await Promise.all([
    listUsers({
      q: sp.get("q") ?? undefined,
      role: sp.get("role") ?? undefined,
      status: sp.get("status") ?? undefined,
    }),
    listRoles(),
  ]);
  return NextResponse.json({ users, roles });
}

/**
 * POST /api/admin/users — add a person.
 * body: { name, email, role, sendEmail?: boolean }
 * Creates the user in `invited` status and mints a 3-day invite. With
 * sendEmail (default true) the welcome email goes out via Resend; either way
 * the invite URL comes back so the admin can copy it.
 */
export async function POST(req: NextRequest) {
  const g = await requirePermission("users.write", "invites.write");
  if (!g.ok) return g.response;
  const { actor } = g;

  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(String(body?.email ?? ""));
  const name = String(body?.name ?? "").trim() || null;
  const role = String(body?.role ?? "member");
  const sendEmail = body?.sendEmail !== false;

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!(await canConferRole(actor, role))) {
    return NextResponse.json(
      { error: "You can't assign a role with permissions you don't hold." },
      { status: 403 }
    );
  }
  if (await getUserByEmail(email)) {
    return NextResponse.json(
      { error: "That person already has an account." },
      { status: 409 }
    );
  }

  try {
    const user = await upsertUser(email, {
      name,
      role,
      status: "invited",
      invitedBy: actor.user.id,
    });

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
    if (sendEmail) {
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
      action: "user.created",
      target: email,
      meta: { role, emailed },
    });

    return NextResponse.json({
      ok: true,
      user,
      invite: { id: invite.id, url, expiresAt: invite.expires_at, emailed },
      // Surfaced so the UI can say "created, but the email didn't send".
      warning: sendEmail && !emailed ? "User created — the invite email failed to send. Copy the link instead." : undefined,
    });
  } catch (e) {
    console.error("[admin] users POST", e);
    return NextResponse.json({ error: "Could not create the user." }, { status: 500 });
  }
}

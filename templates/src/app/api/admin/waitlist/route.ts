import { NextResponse, type NextRequest } from "next/server";
import { requirePermission, canConferRole } from "@/lib/auth/rbac";
import {
  listWaitlist,
  getWaitlistEntry,
  setWaitlistStatus,
  createInvite,
  markInviteSent,
  listRoles,
  audit,
} from "@/lib/auth/admin-db";
import { upsertUser } from "@/lib/auth/db";
import {
  generateInviteToken,
  inviteExpiry,
  inviteUrl,
} from "@/lib/auth/invites";
import { sendInviteEmail } from "@/lib/auth/email-invite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/waitlist?status=pending */
export async function GET(req: NextRequest) {
  const g = await requirePermission("waitlist.read");
  if (!g.ok) return g.response;
  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  return NextResponse.json({ entries: await listWaitlist(status) });
}

/**
 * PATCH /api/admin/waitlist — body: { id, action: "approve" | "reject", role? }
 * Approving creates the account in `invited` status and emails a 3-day invite.
 */
export async function PATCH(req: NextRequest) {
  const g = await requirePermission("waitlist.approve");
  if (!g.ok) return g.response;
  const { actor } = g;

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "");
  const action = String(body?.action ?? "");
  const role = String(body?.role ?? "member");

  const entry = await getWaitlistEntry(id);
  if (!entry) return NextResponse.json({ error: "Entry not found." }, { status: 404 });

  if (action === "reject") {
    await setWaitlistStatus(id, "rejected", actor.user.id);
    await audit({
      actorId: actor.user.id,
      actorEmail: actor.user.email,
      action: "waitlist.rejected",
      target: entry.email,
    });
    return NextResponse.json({ ok: true });
  }

  if (action !== "approve") {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
  if (!(await canConferRole(actor, role))) {
    return NextResponse.json(
      { error: "You can't approve into a role with permissions you don't hold." },
      { status: 403 }
    );
  }

  try {
    await upsertUser(entry.email, {
      name: entry.name,
      role,
      status: "invited",
      invitedBy: actor.user.id,
    });
    const { token, tokenHash } = generateInviteToken();
    const invite = await createInvite({
      email: entry.email,
      name: entry.name,
      role,
      tokenHash,
      expiresAt: inviteExpiry(),
      createdBy: actor.user.id,
    });
    const url = inviteUrl(token);

    let emailed = false;
    try {
      const roles = await listRoles();
      await sendInviteEmail({
        to: entry.email,
        url,
        name: entry.name,
        inviterName: actor.user.name ?? null,
        roleLabel: roles.find((r) => r.key === role)?.label ?? role,
      });
      await markInviteSent(invite.id);
      emailed = true;
    } catch (e) {
      console.error("[admin] waitlist invite email", e);
    }

    await setWaitlistStatus(id, "invited", actor.user.id);
    await audit({
      actorId: actor.user.id,
      actorEmail: actor.user.email,
      action: "waitlist.approved",
      target: entry.email,
      meta: { role, emailed },
    });

    return NextResponse.json({
      ok: true,
      url,
      emailed,
      warning: emailed ? undefined : "Approved — the invite email failed to send. Copy the link.",
    });
  } catch (e) {
    console.error("[admin] waitlist PATCH", e);
    return NextResponse.json({ error: "Could not approve the request." }, { status: 500 });
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/rbac";
import { passkeyTarget } from "@/lib/auth/passkey-admin";
import { generateMagicToken } from "@/lib/auth/tokens";
import { createMagicLink, recentLinkCount } from "@/lib/auth/db";
import { audit } from "@/lib/auth/admin-db";
import { sendPasskeySetupEmail } from "@/lib/auth/email-invite";
import { SITE_URL, PASSKEY_SETUP_PATH } from "@/lib/auth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/users/[id]/passkeys/setup-link  body: { sendEmail?: boolean }
 * The remote path for "add a passkey for this user": mints a single-use magic
 * link that signs them in and lands on PASSKEY_SETUP_PATH, where
 * <PasskeyPrompt/> opens the one-tap enrolment. WebAuthn can only register a
 * credential on the user's own device, so this is how you enrol someone who
 * isn't in the room. The URL is returned so the admin can copy it if email
 * delivery fails.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const g = await requirePermission("users.passkeys");
  if (!g.ok) return g.response;
  const { actor } = g;

  const t = await passkeyTarget(actor, id, { forEnrol: true });
  if (!t.ok) return t.response;
  const body = await req.json().catch(() => ({}));
  const sendEmail = body?.sendEmail !== false;

  if ((await recentLinkCount(t.target.email, 600)) >= 3) {
    return NextResponse.json(
      { error: "Too many links for this address — try again in a few minutes." },
      { status: 429 }
    );
  }

  try {
    const { token, tokenHash } = generateMagicToken();
    await createMagicLink(t.target.email, tokenHash);
    const url = new URL(`${SITE_URL}/api/auth/magic/verify`);
    url.searchParams.set("token", token);
    url.searchParams.set("next", PASSKEY_SETUP_PATH);

    let emailed = false;
    if (sendEmail) {
      try {
        await sendPasskeySetupEmail({
          to: t.target.email,
          url: url.toString(),
          name: t.target.name ?? null,
          inviterName: actor.user.name ?? null,
        });
        emailed = true;
      } catch (e) {
        console.error("[admin] passkey setup email", e);
      }
    }

    await audit({
      actorId: actor.user.id,
      actorEmail: actor.user.email,
      action: "passkey.setup_sent",
      target: t.target.email,
      meta: { emailed },
    });

    return NextResponse.json({
      ok: true,
      url: url.toString(),
      emailed,
      warning:
        sendEmail && !emailed
          ? "Link created — the email failed to send. Copy the link instead."
          : undefined,
    });
  } catch (e) {
    console.error("[admin] passkeys/setup-link", e);
    return NextResponse.json({ error: "Could not create the setup link." }, { status: 500 });
  }
}

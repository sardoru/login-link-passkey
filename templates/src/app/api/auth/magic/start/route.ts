import { NextResponse } from "next/server";
import { normalizeEmail, isValidEmail } from "@/lib/auth/allowlist";
import { generateMagicToken } from "@/lib/auth/tokens";
import { createMagicLink, recentLinkCount, upsertUser } from "@/lib/auth/db";
import { isSignInAllowed } from "@/lib/auth/rbac";
import { sendMagicLinkEmail } from "@/lib/auth/email";
import { SITE_URL, WAITLIST_ENABLED } from "@/lib/auth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let email = "";
  let next = "";
  try {
    const body = await req.json();
    email = normalizeEmail(String(body?.email ?? ""));
    next = String(body?.next ?? "");
  } catch {
    /* ignore */
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  try {
    // Known users (created, invited, or code-redeemed) are allowed even when
    // they aren't in AUTH_ALLOWED_EMAILS.
    if (!(await isSignInAllowed(email))) {
      return NextResponse.json(
        {
          error: "This email isn’t authorized to sign in.",
          waitlist: WAITLIST_ENABLED,
        },
        { status: 403 }
      );
    }
    if ((await recentLinkCount(email, 600)) >= 3) {
      return NextResponse.json(
        { error: "Too many requests — try again in a few minutes." },
        { status: 429 }
      );
    }
    await upsertUser(email);
    const { token, tokenHash } = generateMagicToken();
    await createMagicLink(email, tokenHash);
    const url = new URL(`${SITE_URL}/api/auth/magic/verify`);
    url.searchParams.set("token", token);
    if (next.startsWith("/")) url.searchParams.set("next", next);
    await sendMagicLinkEmail(email, url.toString());
  } catch (e) {
    console.error("[auth] magic/start", e);
    return NextResponse.json(
      { error: "Could not send the link. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

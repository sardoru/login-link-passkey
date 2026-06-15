import { NextResponse } from "next/server";
import { normalizeEmail, isValidEmail, isEmailAllowed } from "@/lib/auth/allowlist";
import { generateMagicToken } from "@/lib/auth/tokens";
import { createMagicLink, recentLinkCount, upsertUser } from "@/lib/auth/db";
import { sendMagicLinkEmail } from "@/lib/auth/email";
import { SITE_URL } from "@/lib/auth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let email = "";
  try {
    const body = await req.json();
    email = normalizeEmail(String(body?.email ?? ""));
  } catch {
    /* ignore */
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!isEmailAllowed(email)) {
    return NextResponse.json(
      { error: "This email isn’t authorized to sign in." },
      { status: 403 }
    );
  }

  try {
    if ((await recentLinkCount(email, 600)) >= 3) {
      return NextResponse.json(
        { error: "Too many requests — try again in a few minutes." },
        { status: 429 }
      );
    }
    await upsertUser(email);
    const { token, tokenHash } = generateMagicToken();
    await createMagicLink(email, tokenHash);
    const url = `${SITE_URL}/api/auth/magic/verify?token=${token}`;
    await sendMagicLinkEmail(email, url);
  } catch (e) {
    console.error("[auth] magic/start", e);
    return NextResponse.json(
      { error: "Could not send the link. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

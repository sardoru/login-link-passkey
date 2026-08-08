import { NextResponse } from "next/server";
import {
  getAccessCodeByCode,
  claimAccessCodeSeat,
  audit,
} from "@/lib/auth/admin-db";
import { upsertUser, createMagicLink, recentLinkCount, getUserByEmail } from "@/lib/auth/db";
import { normalizeAccessCode, accessCodeState } from "@/lib/auth/invites";
import { generateMagicToken } from "@/lib/auth/tokens";
import { sendMagicLinkEmail } from "@/lib/auth/email";
import { normalizeEmail, isValidEmail } from "@/lib/auth/allowlist";
import { SITE_URL } from "@/lib/auth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEAD = "That code isn’t valid, has expired, or is fully claimed.";

/**
 * POST /api/auth/access-code — body: { code, email, name? }
 *
 * Redeeming never issues a session directly: a seat is claimed, the account is
 * created in `invited` status, and a magic link proves the address. A leaked
 * code therefore can't be used to take over an email — worst case it burns a
 * seat, which the admin can revoke.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const code = normalizeAccessCode(String(body?.code ?? ""));
  const email = normalizeEmail(String(body?.email ?? ""));
  const name = String(body?.name ?? "").trim() || null;

  if (!code) return NextResponse.json({ error: "Enter your access code." }, { status: 400 });
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  try {
    const row = await getAccessCodeByCode(code);
    if (!row) return NextResponse.json({ error: DEAD }, { status: 400 });
    const { status } = accessCodeState(row);
    if (status !== "active") return NextResponse.json({ error: DEAD }, { status: 400 });

    if ((await recentLinkCount(email, 600)) >= 3) {
      return NextResponse.json(
        { error: "Too many requests — try again in a few minutes." },
        { status: 429 }
      );
    }

    // Already has an account: don't burn a seat, just send them a sign-in link.
    const existing = await getUserByEmail(email);
    if (!existing) {
      const claimed = await claimAccessCodeSeat(row, email);
      if (!claimed) return NextResponse.json({ error: DEAD }, { status: 409 });
      await upsertUser(email, { name, role: row.role, status: "invited" });
      await audit({
        actorEmail: email,
        action: "code.redeemed",
        target: row.code,
        meta: { role: row.role },
      });
    } else if (existing.status === "suspended") {
      return NextResponse.json({ error: DEAD }, { status: 400 });
    }

    const { token, tokenHash } = generateMagicToken();
    await createMagicLink(email, tokenHash);
    await sendMagicLinkEmail(email, `${SITE_URL}/api/auth/magic/verify?token=${token}`);

    return NextResponse.json({ ok: true, verify: "email", email });
  } catch (e) {
    console.error("[auth] access-code", e);
    return NextResponse.json(
      { error: "Could not redeem that code. Please try again." },
      { status: 500 }
    );
  }
}

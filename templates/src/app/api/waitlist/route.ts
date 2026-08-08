import { NextResponse } from "next/server";
import { addToWaitlist } from "@/lib/auth/admin-db";
import { sendWaitlistReceiptEmail } from "@/lib/auth/email-invite";
import { normalizeEmail, isValidEmail } from "@/lib/auth/allowlist";
import { WAITLIST_ENABLED } from "@/lib/auth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/waitlist — public. body: { email, name?, note?, source?, company? }
 *
 * Always answers `{ ok: true }` for a well-formed address: whether someone is
 * already on the list (or already a user) is not public information. `company`
 * is an unused honeypot field — bots fill it, humans never see it.
 */
export async function POST(req: Request) {
  if (!WAITLIST_ENABLED) {
    return NextResponse.json({ error: "The waitlist is closed." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(String(body?.email ?? ""));
  const name = String(body?.name ?? "").trim().slice(0, 120) || null;
  const note = String(body?.note ?? "").trim().slice(0, 1000) || null;
  const source = String(body?.source ?? "").trim().slice(0, 80) || null;
  const honeypot = String(body?.company ?? "").trim();

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (honeypot) return NextResponse.json({ ok: true }); // silently drop bots

  try {
    await addToWaitlist({ email, name, note, source });
    await sendWaitlistReceiptEmail({ to: email, name }).catch((e) =>
      console.error("[auth] waitlist receipt", e)
    );
  } catch (e) {
    console.error("[auth] waitlist", e);
    return NextResponse.json(
      { error: "Could not add you to the list. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

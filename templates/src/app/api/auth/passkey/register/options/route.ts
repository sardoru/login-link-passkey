import { NextResponse } from "next/server";
import { getSession, challengeCookieOptions } from "@/lib/auth/server";
import { registrationOptionsFor } from "@/lib/auth/passkey-registration";
import { signChallenge } from "@/lib/auth/session";
import { CHALLENGE_COOKIE_REG } from "@/lib/auth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Start registering a passkey for the signed-in user (works for the 2nd, 3rd… too). */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const options = await registrationOptionsFor(req, {
    id: session.sub,
    email: session.email,
  });
  const challenge = await signChallenge(
    { ch: options.challenge, sub: session.sub },
    300
  );
  const res = NextResponse.json(options);
  res.cookies.set(CHALLENGE_COOKIE_REG, challenge, challengeCookieOptions());
  return res;
}

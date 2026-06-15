import { NextResponse, type NextRequest } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { getSession, challengeCookieOptions } from "@/lib/auth/server";
import { createPasskey } from "@/lib/auth/db";
import { getRP, toB64url } from "@/lib/auth/webauthn";
import { verifyChallenge } from "@/lib/auth/session";
import { CHALLENGE_COOKIE_REG } from "@/lib/auth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.response)
    return NextResponse.json({ error: "Missing response" }, { status: 400 });

  const payload = await verifyChallenge(
    req.cookies.get(CHALLENGE_COOKIE_REG)?.value
  );
  if (!payload || payload.sub !== session.sub)
    return NextResponse.json({ error: "Challenge expired — try again." }, { status: 400 });

  const { rpID, origin } = getRP(req);
  try {
    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: String(payload.ch),
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
    if (!verification.verified || !verification.registrationInfo)
      return NextResponse.json({ error: "Could not verify passkey." }, { status: 400 });

    const cred = verification.registrationInfo.credential;
    await createPasskey({
      userId: session.sub,
      credentialId: cred.id,
      publicKey: toB64url(cred.publicKey),
      counter: cred.counter,
      transports: cred.transports?.length ? cred.transports.join(",") : null,
    });
  } catch (e) {
    console.error("[auth] passkey/register/verify", e);
    return NextResponse.json({ error: "Could not verify passkey." }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(CHALLENGE_COOKIE_REG, "", {
    ...challengeCookieOptions(0),
    maxAge: 0,
  });
  return res;
}

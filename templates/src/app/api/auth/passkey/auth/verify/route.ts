import { NextResponse, type NextRequest } from "next/server";
import {
  verifyAuthenticationResponse,
  type AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import {
  getPasskeyByCredentialId,
  getUserById,
  touchLogin,
  updatePasskeyCounter,
} from "@/lib/auth/db";
import { activateUser } from "@/lib/auth/db";
import { getRP, fromB64url } from "@/lib/auth/webauthn";
import { signSession, verifyChallenge } from "@/lib/auth/session";
import { sessionPayloadFor, maybeBootstrapOwner } from "@/lib/auth/rbac";
import { sessionCookieOptions, challengeCookieOptions } from "@/lib/auth/server";
import { SESSION_COOKIE, CHALLENGE_COOKIE_AUTH } from "@/lib/auth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const response = body?.response;
  if (!response?.id)
    return NextResponse.json({ error: "Missing response" }, { status: 400 });

  const payload = await verifyChallenge(
    req.cookies.get(CHALLENGE_COOKIE_AUTH)?.value
  );
  if (!payload)
    return NextResponse.json({ error: "Challenge expired — try again." }, { status: 400 });

  const passkey = await getPasskeyByCredentialId(response.id);
  if (!passkey)
    return NextResponse.json(
      { error: "Passkey not recognized. Use your email link." },
      { status: 400 }
    );

  const { rpID, origin } = getRP(req);
  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: String(payload.ch),
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
      credential: {
        id: passkey.credential_id,
        publicKey: fromB64url(passkey.public_key),
        counter: passkey.counter,
        transports: passkey.transports
          ? (passkey.transports.split(",") as AuthenticatorTransportFuture[])
          : undefined,
      },
    });
    if (!verification.verified)
      return NextResponse.json({ error: "Could not verify passkey." }, { status: 400 });

    await updatePasskeyCounter(passkey.id, verification.authenticationInfo.newCounter);
  } catch (e) {
    console.error("[auth] passkey/auth/verify", e);
    return NextResponse.json({ error: "Could not verify passkey." }, { status: 400 });
  }

  let user = await getUserById(passkey.user_id);
  if (!user)
    return NextResponse.json({ error: "Account not found." }, { status: 400 });
  if (user.status === "suspended")
    return NextResponse.json(
      { error: "This account has been suspended." },
      { status: 403 }
    );
  user = await maybeBootstrapOwner(user);
  await touchLogin(user.id);
  await activateUser(user.id);

  const jwt = await signSession(await sessionPayloadFor(user));
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, jwt, sessionCookieOptions());
  res.cookies.set(CHALLENGE_COOKIE_AUTH, "", {
    ...challengeCookieOptions(0),
    maxAge: 0,
  });
  return res;
}

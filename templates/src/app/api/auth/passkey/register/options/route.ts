import { NextResponse } from "next/server";
import {
  generateRegistrationOptions,
  type AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { getSession, challengeCookieOptions } from "@/lib/auth/server";
import { listPasskeys } from "@/lib/auth/db";
import { getRP } from "@/lib/auth/webauthn";
import { signChallenge } from "@/lib/auth/session";
import { CHALLENGE_COOKIE_REG } from "@/lib/auth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { rpID, rpName } = getRP(req);
  const existing = await listPasskeys(session.sub);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: session.email,
    userID: new TextEncoder().encode(session.sub),
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({
      id: p.credential_id,
      transports: p.transports
        ? (p.transports.split(",") as AuthenticatorTransportFuture[])
        : undefined,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  const challenge = await signChallenge(
    { ch: options.challenge, sub: session.sub },
    300
  );
  const res = NextResponse.json(options);
  res.cookies.set(CHALLENGE_COOKIE_REG, challenge, challengeCookieOptions());
  return res;
}

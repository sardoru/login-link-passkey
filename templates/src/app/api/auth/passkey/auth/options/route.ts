import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { challengeCookieOptions } from "@/lib/auth/server";
import { getRP } from "@/lib/auth/webauthn";
import { signChallenge } from "@/lib/auth/session";
import { CHALLENGE_COOKIE_AUTH } from "@/lib/auth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { rpID } = getRP(req);
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
    allowCredentials: [], // discoverable credentials → usernameless sign-in
  });
  const challenge = await signChallenge({ ch: options.challenge }, 300);
  const res = NextResponse.json(options);
  res.cookies.set(CHALLENGE_COOKIE_AUTH, challenge, challengeCookieOptions());
  return res;
}

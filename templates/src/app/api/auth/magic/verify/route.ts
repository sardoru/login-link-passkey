import { NextResponse } from "next/server";
import { hashToken } from "@/lib/auth/tokens";
import { consumeMagicLink, upsertUser, touchLogin } from "@/lib/auth/db";
import { signSession } from "@/lib/auth/session";
import { sessionCookieOptions } from "@/lib/auth/server";
import { SESSION_COOKIE } from "@/lib/auth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const login = new URL("/login", req.url);

  if (!token) {
    login.searchParams.set("error", "invalid");
    return NextResponse.redirect(login);
  }

  try {
    const email = await consumeMagicLink(hashToken(token));
    if (!email) {
      login.searchParams.set("error", "expired");
      return NextResponse.redirect(login);
    }
    const user = await upsertUser(email);
    await touchLogin(user.id);
    const jwt = await signSession({ sub: user.id, email });
    const res = NextResponse.redirect(new URL("/", req.url));
    res.cookies.set(SESSION_COOKIE, jwt, sessionCookieOptions());
    return res;
  } catch (e) {
    console.error("[auth] magic/verify", e);
    login.searchParams.set("error", "server");
    return NextResponse.redirect(login);
  }
}

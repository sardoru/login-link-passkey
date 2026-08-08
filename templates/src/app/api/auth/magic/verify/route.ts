import { NextResponse } from "next/server";
import { hashToken } from "@/lib/auth/tokens";
import {
  consumeMagicLink,
  upsertUser,
  touchLogin,
  activateUser,
} from "@/lib/auth/db";
import { signSession } from "@/lib/auth/session";
import { sessionCookieOptions } from "@/lib/auth/server";
import { sessionPayloadFor, maybeBootstrapOwner } from "@/lib/auth/rbac";
import { SESSION_COOKIE } from "@/lib/auth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const next = url.searchParams.get("next");
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
    let user = await upsertUser(email);
    if (user.status === "suspended") {
      login.searchParams.set("error", "suspended");
      return NextResponse.redirect(login);
    }
    user = await maybeBootstrapOwner(user);
    await touchLogin(user.id);
    await activateUser(user.id); // invited → active on first real sign-in

    const jwt = await signSession(await sessionPayloadFor(user));
    const dest = next && next.startsWith("/") ? next : "/";
    const res = NextResponse.redirect(new URL(dest, req.url));
    res.cookies.set(SESSION_COOKIE, jwt, sessionCookieOptions());
    return res;
  } catch (e) {
    console.error("[auth] magic/verify", e);
    login.searchParams.set("error", "server");
    return NextResponse.redirect(login);
  }
}

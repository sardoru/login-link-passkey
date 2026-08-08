import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/config";
import { can } from "@/lib/auth/permissions";

/** Reachable without a session: sign-in, invitations, code redemption, waitlist. */
const PUBLIC_PREFIXES = ["/login", "/invite", "/join", "/waitlist"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySessionToken(
    req.cookies.get(SESSION_COOKIE)?.value
  );

  if (isPublic(pathname)) {
    // Signed-in users don't need the sign-in page; the others still work
    // (an invite may be for a different account, a code adds a seat).
    if (session && pathname === "/login") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    const login = new URL("/login", req.url);
    if (pathname !== "/") login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  // Admin area. This reads the permission snapshot in the session — fast, but
  // only a routing hint. The /admin layout and every /api/admin route re-check
  // against the database, which is what actually enforces access.
  if (pathname.startsWith("/admin") && !can(session.perms, "admin.access")) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Everything except auth APIs, Next internals, and public branding assets.
  // The `.*opengraph-image|.*twitter-image` alternatives matter: nested OG
  // routes like /login/opengraph-image would otherwise be gated, and link
  // previews (Slack, iMessage, X) fetch them without a session.
  matcher: [
    "/((?!api|_next/static|_next/image|.*opengraph-image|.*twitter-image|favicon.ico|icon.svg|apple-icon|robots.txt|sitemap.xml).*)",
  ],
};

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { countPasskeys } from "@/lib/auth/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ authenticated: false });
  let hasPasskey = false;
  try {
    hasPasskey = (await countPasskeys(session.sub)) > 0;
  } catch {
    /* ignore */
  }
  return NextResponse.json({
    authenticated: true,
    email: session.email,
    hasPasskey,
  });
}

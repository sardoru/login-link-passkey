import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { listPasskeyInfo } from "@/lib/auth/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/auth/passkeys — the signed-in user's own passkeys (metadata only). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const passkeys = await listPasskeyInfo(session.sub);
  return NextResponse.json({ passkeys });
}

import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/rbac";
import { getUserById, listPasskeyInfo } from "@/lib/auth/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/users/[id]/passkeys — a user's passkeys (metadata only). */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const g = await requirePermission("users.read");
  if (!g.ok) return g.response;

  const user = await getUserById(id);
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
  const passkeys = await listPasskeyInfo(id);
  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name ?? null, role: user.role },
    passkeys,
  });
}

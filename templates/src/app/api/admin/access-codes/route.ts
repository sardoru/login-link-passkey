import { NextResponse, type NextRequest } from "next/server";
import { requirePermission, canConferRole } from "@/lib/auth/rbac";
import {
  createAccessCode,
  listAccessCodes,
  listCodeUses,
  revokeAccessCode,
  audit,
} from "@/lib/auth/admin-db";
import {
  generateAccessCode,
  accessCodeState,
  joinUrl,
} from "@/lib/auth/invites";
import { ACCESS_CODE_DEFAULT_USES } from "@/lib/auth/config";
import { BRAND } from "@/lib/auth/brand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/access-codes — codes with live state, or ?id=… for its uses. */
export async function GET(req: NextRequest) {
  const g = await requirePermission("codes.read");
  if (!g.ok) return g.response;

  const id = req.nextUrl.searchParams.get("id");
  if (id) return NextResponse.json({ uses: await listCodeUses(id) });

  const codes = await listAccessCodes();
  return NextResponse.json({
    codes: codes.map((c) => ({
      ...c,
      ...accessCodeState(c),
      joinUrl: joinUrl(c.code),
    })),
    defaultUses: ACCESS_CODE_DEFAULT_USES,
  });
}

/**
 * POST /api/admin/access-codes — mint a multi-seat signup code.
 * body: { label?, role?, maxUses?, expiresInDays?|expiresAt? }
 *
 * Seats default to 10 and accept any value ≥ 1. Redeeming a code never signs
 * anyone in directly: the address is always verified by magic link first, so a
 * leaked code can't be used to impersonate an email.
 */
export async function POST(req: NextRequest) {
  const g = await requirePermission("codes.write");
  if (!g.ok) return g.response;
  const { actor } = g;

  const body = await req.json().catch(() => ({}));
  const role = String(body?.role ?? "member");
  const label = String(body?.label ?? "").trim() || null;
  const maxUses = Math.max(
    1,
    Math.floor(Number(body?.maxUses ?? ACCESS_CODE_DEFAULT_USES)) || ACCESS_CODE_DEFAULT_USES
  );

  let expiresAt: string | null = null;
  if (body?.expiresAt) {
    expiresAt = new Date(String(body.expiresAt)).toISOString();
  } else if (Number(body?.expiresInDays) > 0) {
    expiresAt = new Date(
      Date.now() + Number(body.expiresInDays) * 86_400_000
    ).toISOString();
  }

  if (!(await canConferRole(actor, role))) {
    return NextResponse.json(
      { error: "You can't issue a code for a role with permissions you don't hold." },
      { status: 403 }
    );
  }

  try {
    const code = generateAccessCode(BRAND.appName.slice(0, 4));
    const row = await createAccessCode({
      code,
      label,
      role,
      maxUses,
      expiresAt,
      createdBy: actor.user.id,
    });
    await audit({
      actorId: actor.user.id,
      actorEmail: actor.user.email,
      action: "code.created",
      target: code,
      meta: { role, maxUses, expiresAt },
    });
    return NextResponse.json({
      ok: true,
      code: { ...row, ...accessCodeState(row), joinUrl: joinUrl(row.code) },
    });
  } catch (e) {
    console.error("[admin] codes POST", e);
    return NextResponse.json({ error: "Could not create the code." }, { status: 500 });
  }
}

/** PATCH /api/admin/access-codes — body: { id, action: "revoke" }. */
export async function PATCH(req: NextRequest) {
  const g = await requirePermission("codes.revoke");
  if (!g.ok) return g.response;
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "");
  if (!id) return NextResponse.json({ error: "Missing code id." }, { status: 400 });

  await revokeAccessCode(id);
  await audit({
    actorId: g.actor.user.id,
    actorEmail: g.actor.user.email,
    action: "code.revoked",
    target: id,
  });
  return NextResponse.json({ ok: true });
}

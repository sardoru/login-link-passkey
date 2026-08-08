import { authOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og/auth-og";
import { BRAND } from "@/lib/auth/brand";
import { hashToken } from "@/lib/auth/invites";
import { findLiveInvite } from "@/lib/auth/admin-db";

export const alt = `You're invited to ${BRAND.appName}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const runtime = "nodejs";

// Personalized when the link is live, generic otherwise — a dead or revoked
// token must not reveal whether it ever existed.
export default async function Image({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let firstName: string | null = null;
  let live = false;

  try {
    const invite = await findLiveInvite(hashToken(token));
    if (invite) {
      live = true;
      firstName = invite.name?.trim().split(/\s+/)[0] ?? null;
    }
  } catch {
    /* render the generic card */
  }

  return authOgImage({
    eyebrow: "Invitation",
    title: firstName
      ? `${firstName}, you're invited to ${BRAND.appName}`
      : `You're invited to ${BRAND.appName}`,
    subtitle: live
      ? "Accept to set up your account — no password required."
      : "Sign in or request access.",
    chip: live ? "Expires in 3 days" : undefined,
  });
}

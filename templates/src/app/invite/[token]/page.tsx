import type { Metadata } from "next";
import { InviteView } from "@/components/views/invite";
import { hashToken } from "@/lib/auth/invites";
import { findLiveInvite, getRole } from "@/lib/auth/admin-db";
import { BRAND } from "@/lib/auth/brand";
import { SITE_URL } from "@/lib/auth/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  // Absolute base for the OG/Twitter card URLs — unfurlers reject relative ones.
  metadataBase: new URL(SITE_URL),
  title: `You're invited to ${BRAND.appName}`,
  description: `Accept your invitation to ${BRAND.appName}.`,
  openGraph: {
    title: `You're invited to ${BRAND.appName}`,
    description: `${BRAND.tagline} — accept your invitation.`,
    type: "website",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: false, follow: false }, // the OG card still renders when shared
};

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let valid = false;
  let boundEmail: string | null = null;
  let inviteeName: string | null = null;
  let roleLabel: string | null = null;
  let expiresAt: string | null = null;

  try {
    const invite = await findLiveInvite(hashToken(token));
    if (invite) {
      valid = true;
      boundEmail = invite.email;
      inviteeName = invite.name;
      expiresAt = invite.expires_at;
      roleLabel = (await getRole(invite.role))?.label ?? invite.role;
    }
  } catch (e) {
    console.error("[auth] invite page", e);
  }

  return (
    <InviteView
      token={token}
      valid={valid}
      boundEmail={boundEmail}
      inviteeName={inviteeName}
      roleLabel={roleLabel}
      expiresAt={expiresAt}
    />
  );
}

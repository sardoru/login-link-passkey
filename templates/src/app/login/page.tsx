import type { Metadata } from "next";
import { LoginView } from "@/components/views/login";
import { BRAND } from "@/lib/auth/brand";
import { SITE_URL } from "@/lib/auth/config";

// opengraph-image.tsx / twitter-image.tsx in this folder supply the card art;
// Next wires them in automatically. noindex still unfurls in Slack/iMessage.
export const metadata: Metadata = {
  // Absolute base for the OG/Twitter card URLs — unfurlers reject relative ones.
  metadataBase: new URL(SITE_URL),
  title: "Sign in",
  description: `Sign in to ${BRAND.appName}.`,
  openGraph: {
    title: `Sign in to ${BRAND.appName}`,
    description: `${BRAND.tagline} — magic link or passkey.`,
    type: "website",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const sp = await searchParams;
  return <LoginView initialError={sp.error} next={sp.next} />;
}

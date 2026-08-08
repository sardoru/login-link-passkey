import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WaitlistView } from "@/components/views/waitlist";
import { BRAND } from "@/lib/auth/brand";
import { SITE_URL, WAITLIST_ENABLED } from "@/lib/auth/config";

export const metadata: Metadata = {
  // Absolute base for the OG/Twitter card URLs — unfurlers reject relative ones.
  metadataBase: new URL(SITE_URL),
  title: `Request access to ${BRAND.appName}`,
  description: `Join the ${BRAND.appName} waitlist.`,
  openGraph: { title: `Request access to ${BRAND.appName}`, type: "website" },
  twitter: { card: "summary_large_image" },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ src?: string }>;
}) {
  if (!WAITLIST_ENABLED) notFound();
  const sp = await searchParams;
  return <WaitlistView source={sp.src} />;
}

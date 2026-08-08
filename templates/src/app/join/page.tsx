import type { Metadata } from "next";
import { JoinView } from "@/components/views/join";
import { BRAND } from "@/lib/auth/brand";
import { SITE_URL } from "@/lib/auth/config";

export const metadata: Metadata = {
  // Absolute base for the OG/Twitter card URLs — unfurlers reject relative ones.
  metadataBase: new URL(SITE_URL),
  title: `Join ${BRAND.appName}`,
  description: `Redeem your access code to create a ${BRAND.appName} account.`,
  openGraph: { title: `Join ${BRAND.appName}`, type: "website" },
  twitter: { card: "summary_large_image" },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const sp = await searchParams;
  return <JoinView initialCode={sp.code} />;
}

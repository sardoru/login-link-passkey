import type { Metadata } from "next";
import { LoginView } from "@/components/views/login";

export const metadata: Metadata = {
  title: "Sign in",
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

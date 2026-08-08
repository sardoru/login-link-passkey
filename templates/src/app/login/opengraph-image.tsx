import { authOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og/auth-og";
import { BRAND } from "@/lib/auth/brand";

export const alt = `Sign in to ${BRAND.appName}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return authOgImage({
    eyebrow: "Secure sign-in",
    title: `Sign in to ${BRAND.appName}`,
    subtitle: "Magic link or passkey — no password to remember.",
    chip: "Authorized users only",
  });
}

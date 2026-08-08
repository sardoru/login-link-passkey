import { authOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og/auth-og";
import { BRAND } from "@/lib/auth/brand";

export const alt = `Request access to ${BRAND.appName}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return authOgImage({
    eyebrow: "Waitlist",
    title: `Request access to ${BRAND.appName}`,
    subtitle: "Join the waitlist — we'll email you when a seat opens.",
  });
}

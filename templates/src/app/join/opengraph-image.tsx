import { authOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og/auth-og";
import { BRAND } from "@/lib/auth/brand";

export const alt = `Join ${BRAND.appName} with an access code`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return authOgImage({
    eyebrow: "Access code",
    title: `Join ${BRAND.appName}`,
    subtitle: "Have a code? Redeem it to create your account.",
    chip: "Invite only",
  });
}

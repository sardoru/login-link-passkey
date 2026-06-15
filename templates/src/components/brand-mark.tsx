// Generic monogram mark driven by BRAND.appName. Swap for a real logo/SVG
// if you have one — the login screen just renders <BrandMark size={40} />.
import { BRAND } from "@/lib/auth/brand";
import { cx } from "./auth/cx";

export function BrandMark({
  size = 40,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const initial = BRAND.appName.trim().charAt(0).toUpperCase() || "•";
  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.46 }}
      className={cx(
        "inline-grid shrink-0 place-items-center rounded-xl bg-brass font-bold text-white",
        className
      )}
      aria-hidden
    >
      {initial}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Shared OG-card renderer for the public auth surfaces (login, invite, join,
// waitlist). One look, four pages. Uses next/og — a Satori subset: flexbox
// only, no CSS grid, no external stylesheets, every element needs an explicit
// `display`. Colors come from BRAND.email (literal hex — CSS vars don't work
// here either).
// ---------------------------------------------------------------------------

import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/auth/brand";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

export interface AuthOgOptions {
  /** Small uppercase line above the title, e.g. "Invitation". */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Pill in the bottom-right, e.g. "Expires in 3 days". */
  chip?: string;
}

export function authOgImage(o: AuthOgOptions): ImageResponse {
  const c = BRAND.email;
  const ink = "#0f1720";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: `linear-gradient(135deg, ${ink} 0%, #16222e 52%, ${ink} 100%)`,
          padding: "72px 80px",
          position: "relative",
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        {/* Brass wash. Satori clips a gradient to its box, so the fade lives
            inside a circle — a rectangular div would show a hard edge. */}
        <div
          style={{
            position: "absolute",
            top: -300,
            left: -160,
            width: 820,
            height: 820,
            display: "flex",
            borderRadius: 9999,
            background: `radial-gradient(circle at center, ${c.accent}4d 0%, ${c.accent}26 38%, ${c.accent}0d 62%, transparent 100%)`,
          }}
        />
        {/* top rule */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 10,
            display: "flex",
            background: `linear-gradient(90deg, ${c.accent} 0%, ${c.accent}88 45%, transparent 100%)`,
          }}
        />

        {/* wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 68,
              height: 68,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 16,
              background: c.accent,
              color: ink,
              fontSize: 34,
              fontWeight: 700,
            }}
          >
            {BRAND.appName.charAt(0).toUpperCase()}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: 2,
                color: "#f3ece0",
              }}
            >
              {BRAND.appName.toUpperCase()}
            </div>
            <div
              style={{
                fontSize: 17,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: c.accent,
                fontFamily: "Arial, Helvetica, sans-serif",
              }}
            >
              {BRAND.tagline}
            </div>
          </div>
        </div>

        {/* headline */}
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 900 }}>
          {o.eyebrow ? (
            <div
              style={{
                display: "flex",
                fontSize: 20,
                letterSpacing: 4,
                textTransform: "uppercase",
                color: c.accent,
                marginBottom: 18,
                fontFamily: "Arial, Helvetica, sans-serif",
              }}
            >
              {o.eyebrow}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              fontSize: o.title.length > 34 ? 66 : 82,
              lineHeight: 1.05,
              color: "#f7f2e8",
            }}
          >
            {o.title}
          </div>
          {o.subtitle ? (
            <div
              style={{
                display: "flex",
                marginTop: 22,
                fontSize: 28,
                lineHeight: 1.4,
                color: "#a9b3bf",
                fontFamily: "Arial, Helvetica, sans-serif",
              }}
            >
              {o.subtitle}
            </div>
          ) : null}
        </div>

        {/* footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontFamily: "Arial, Helvetica, sans-serif",
          }}
        >
          <div style={{ display: "flex", fontSize: 20, color: "#78838f" }}>
            {BRAND.footerNote}
          </div>
          {o.chip ? (
            <div
              style={{
                display: "flex",
                padding: "10px 22px",
                borderRadius: 999,
                border: `1px solid ${c.accent}66`,
                color: c.accent,
                fontSize: 20,
              }}
            >
              {o.chip}
            </div>
          ) : null}
        </div>
      </div>
    ),
    OG_SIZE
  );
}

// ---------------------------------------------------------------------------
// BRAND — single source of truth for auth UI + email branding.
// Edit these values per project. The login screen reads name/tagline/footer;
// the email uses the literal hex colors below (email clients can't use CSS vars).
// Keep the email palette in sync with your auth-tokens.css if you want them to match.
// ---------------------------------------------------------------------------

export const BRAND = {
  appName: "Acme", // wordmark + email + subject
  tagline: "Operator Console", // small line under the name
  product: "Acme", // footer attribution ("A {product} product")
  footerNote: "Confidential — authorized users only.",

  email: {
    bg: "#f1ede3", // page background
    card: "#ffffff", // card background
    ink: "#17212c", // headings + button fill
    body: "#46525f", // body copy
    accent: "#a8853f", // brand accent (brass/gold here)
    line: "#e3dccd", // hairlines
    muted: "#9aa3ad", // fine print
    // Logo shown at the top of the email. Absolute URL, or a path that will be
    // resolved against NEXT_PUBLIC_SITE_URL (e.g. "/apple-icon" — must be a
    // publicly reachable PNG; SVGs and data: URIs are unreliable in email).
    logoUrl: "/apple-icon",
    logoRadius: 10,
  },
} as const;

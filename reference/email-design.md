# The magic-link email — design & customization

The goal: **not bland.** A small, branded, table-based HTML email that renders
the same in Gmail, Apple Mail, and Outlook.

## Anatomy (`src/lib/auth/email.ts`)

```
┌───────────────────────────────┐
│ ▒ 4px accent rule (brand)      │  ← BRAND.email.accent
│ [logo]  APPNAME                │  ← logo (PNG) + serif wordmark
│         tagline (accent caps)  │
│                                │
│ Your sign-in link              │  ← serif H1
│ Tap the button… (15 min, once) │  ← body copy
│                                │
│ ▌ Sign in to AppName →  ▐      │  ← ink button (high-contrast)
│                                │
│ Or paste this link:            │
│ https://…/magic/verify?token=… │  ← monospace fallback (accent)
│ ──────────────────────────     │
│ If you didn't request this…    │  ← reassurance
│ Confidential · A Product item  │  ← footer
└───────────────────────────────┘
```

Design choices that make it read as crafted, not transactional:
- A **brass/accent hairline** at the top + an **ink (near-black) button** for
  contrast — not a generic blue link.
- A **serif** wordmark + headline (`Georgia`) against a **sans** body (`Arial`) —
  the institutional pairing. No web-font dependency (those don't load in email).
- A real **logo image** (PNG) — see deliverability below.
- A monospace fallback URL so the link is usable even if the button is stripped.
- A hidden **preheader** line for the inbox preview.

## Customize via `brand.ts` (don't touch the markup)

```ts
BRAND.appName, BRAND.tagline, BRAND.product, BRAND.footerNote
BRAND.email = { bg, card, ink, body, accent, line, muted, logoUrl, logoRadius }
```

Keep `email.accent` / `email.ink` in sync with your `--brass` / `--ink` tokens so
the email matches the app.

## Deliverability

- **Verified domain required** to email anyone but the Resend key owner. Use
  `scripts/find-resend-domain.sh` and set `AUTH_EMAIL_FROM=Name <login@domain>`.
- **Logo must be a public PNG** at an absolute URL. `logoUrl` defaults to
  `/apple-icon` (resolved against `NEXT_PUBLIC_SITE_URL`); make sure that route is
  excluded from the auth gate (the proxy matcher already excludes `apple-icon`).
  Gmail/Outlook proxy images and **strip SVGs and `data:` URIs** — don't use them.
- A plain-text alternative is included automatically (good for spam scoring).

## Preview without sending

`magicLinkHtml` is exported. Render it to a file and open in a browser:

```bash
# from the project root, with deps installed
node --input-type=module -e '
import { magicLinkHtml } from "./src/lib/auth/email.ts";
import { writeFileSync } from "fs";
writeFileSync("/tmp/email.html", magicLinkHtml("https://example.com/api/auth/magic/verify?token=DEMO"));
'  2>/dev/null || npx tsx -e 'import {magicLinkHtml} from "./src/lib/auth/email";import {writeFileSync} from "fs";writeFileSync("/tmp/email.html",magicLinkHtml("https://example.com/verify?token=DEMO"))'
open /tmp/email.html
```

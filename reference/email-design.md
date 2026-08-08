# The auth emails — design & customization

The goal: **not bland.** A small, branded, table-based HTML email that renders
the same in Gmail, Apple Mail, and Outlook.

## The four emails

All of them share one chrome (`src/lib/auth/email-shell.ts`), so branding is
edited once and every message follows:

| Email | Sent by | Trigger |
| --- | --- | --- |
| **Sign-in link** | `email.ts → sendMagicLinkEmail` | `/login`, code redemption, open-invite verification |
| **Invitation / welcome** | `email-invite.ts → sendInviteEmail` | Admin adds a user, sends an invite, or approves a waitlist entry |
| **Access code** | `email-invite.ts → sendAccessCodeEmail` | Optional — mailing a code to someone directly |
| **Waitlist receipt** | `email-invite.ts → sendWaitlistReceiptEmail` | Public `/waitlist` signup |

Every one goes through `send()` in `email.ts`, which is the single place the
project's `RESEND_API_KEY` and `AUTH_EMAIL_FROM` are used.

`emailShell()` takes `{preheader, title, heading, body, cta?, altUrl?, badge?,
footnote?}`; `p()` formats a paragraph and `codeBlock()` renders a boxed,
monospaced access code. The invite adds a **badge pill** ("Invitation") above the
headline — the one structural difference from the sign-in mail.

## Anatomy (`src/lib/auth/email-shell.ts`)

```
┌───────────────────────────────┐
│ ▒ 4px accent rule (brand)      │  ← BRAND.email.accent
│ [logo]  APPNAME                │  ← logo (PNG) + serif wordmark
│         tagline (accent caps)  │
│                                │
│ ( INVITATION )                 │  ← optional badge pill
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

`magicLinkHtml`, `inviteHtml`, and `accessCodeHtml` are all exported. Render one
to a file and open it in a browser:

```bash
# from the project root, with deps installed
node --input-type=module -e '
import { magicLinkHtml } from "./src/lib/auth/email.ts";
import { writeFileSync } from "fs";
writeFileSync("/tmp/email.html", magicLinkHtml("https://example.com/api/auth/magic/verify?token=DEMO"));
'  2>/dev/null || npx tsx -e 'import {magicLinkHtml} from "./src/lib/auth/email";import {writeFileSync} from "fs";writeFileSync("/tmp/email.html",magicLinkHtml("https://example.com/verify?token=DEMO"))'
open /tmp/email.html
```

Swap in `inviteHtml({url, name, inviterName, roleLabel})` or
`accessCodeHtml({code, joinUrl, name})` from `email-invite.ts` to check those.

## Copy notes

- The invite says the link **expires in 3 days and works once** — matching
  `AUTH_INVITE_TTL_DAYS`. If you change the variable, the copy follows it
  automatically (`days()` in `email-invite.ts`).
- Names are `esc()`-escaped everywhere they interpolate — an invitee named
  `<script>` renders as text, not markup.
- The waitlist receipt deliberately promises nothing about timing.

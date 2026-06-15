---
name: login-link-passkey
description: >-
  Add passwordless authentication — a branded magic-link email (Resend + Supabase)
  plus Apple / WebAuthn passkeys — to a Next.js App Router app and gate the whole
  app behind it. Drops in a tested auth engine (jose sessions, an edge proxy gate,
  single-use SHA-256-hashed links, an email allow-list), a beautifully designed
  (non-bland) Resend email, and a one-tap "Add passkey" flow with NO device-name
  prompt. Optionally provisions Supabase and finds a verified Resend domain and
  sets env vars. Use when the user says 'add login', 'magic link auth',
  'passwordless auth', 'add passkeys', 'gate this app', 'login-link-passkey',
  'add authentication', or wants email magic-link + passkey sign-in.
argument-hint: '[--app "App Name"] [--from "Name <login@domain>"] [--allow a@x.com,b@y.com] [--accent #HEX]'
user-invocable: true
tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

# login-link-passkey — Magic-link + Passkey auth

Drop a complete, tested passwordless-auth system into a **Next.js App Router**
project: branded **magic-link email** (Resend) + **WebAuthn passkeys**, backed by
**Supabase**, with the entire app gated at the edge. This is the same combo from
the Exchange P&L build, generalized.

## What it installs

- **Edge gate** (`src/proxy.ts`, Next 16) — verifies a signed session (jose) on
  every request; unauthenticated users go to `/login`. Auth APIs + branding
  assets are excluded.
- **Magic links** — single-use, 15-min tokens; only the **SHA-256 hash** is
  stored. Branded email via Resend. Allow-listed emails only, rate-limited.
- **Passkeys** — usernameless (discoverable) sign-in + **one-tap registration
  with no nickname prompt** ("Add passkey" just works).
- **Supabase store** — `auth_users / auth_magic_links / auth_passkeys`, RLS on
  with **no policies** (default-deny); server uses the service-role key only.
- **UI** — `/login` screen, top-bar account menu (add passkey / sign out), and a
  dismissible "add a passkey" prompt. Styled with portable CSS tokens.

## Prerequisites (verify first)

1. **Next.js App Router** with the `@/* → ./src/*` tsconfig alias (default
   create-next-app). Confirm `src/app/` exists.
2. **Tailwind v4** (the UI templates use it). If absent, you'll restyle the 3 UI
   components or add Tailwind.
3. **`lucide-react`** for icons (installed below if missing).
4. Secrets the user must supply: a **Resend API key**, and either a **Supabase
   management token** (`sbp_…`, lets this skill provision everything) OR an
   existing project's **URL + service-role key**.

## Procedure

### 1 — Gather brand + config

Ask (or take from args) and keep concise:
- **App name** + **tagline** (wordmark + email), **accent color** (hex).
- **From address** — must be on a Resend-verified domain
  (`scripts/find-resend-domain.sh`; falls back to `onboarding@resend.dev` which
  only delivers to the key owner).
- **Allow-list** of emails (comma-separated). Empty = open (warn the user).
- **Site URL** (canonical; used for link base + WebAuthn origin).

### 2 — Install dependencies

```bash
npm install resend @supabase/supabase-js @simplewebauthn/server @simplewebauthn/browser jose
npm install lucide-react   # if not already present
```

### 3 — Copy templates into the project

Copy `templates/src/**` → the project's `src/**` (preserve structure), and
`templates/supabase/0001_auth.sql` → `supabase/migrations/` (or anywhere handy).
File map:

| Template | Purpose |
| --- | --- |
| `src/lib/auth/{config,brand,allowlist,tokens,session,db,email,webauthn,server}.ts` | Auth engine + brand |
| `src/app/api/auth/**` | magic start/verify, passkey options/verify, logout, me |
| `src/proxy.ts` | Edge gate (Next 16) |
| `src/app/login/page.tsx`, `src/components/views/login.tsx` | Login screen |
| `src/components/brand-mark.tsx` | Monogram mark |
| `src/components/auth/{cx,auth-context,passkey-client,account-menu,passkey-prompt}.tsx` | Client auth UI |
| `src/styles/auth-tokens.css` | Color tokens for the UI |

Then:
- **Brand** — edit `src/lib/auth/brand.ts` (name, tagline, colors, logo, footer).
- **Tokens** — paste `src/styles/auth-tokens.css` into the project's
  `globals.css` *after* `@import "tailwindcss";` (or `@import` it). Set `--brass`
  (light + dark) to the accent color. If the project already has a palette, map
  the token names to it instead, or restyle the 3 UI components.
- **Next 15?** Rename `src/proxy.ts` → `src/middleware.ts` and
  `export function proxy` → `export function middleware` (keep the `config`).
- **Email logo** — `brand.ts → email.logoUrl` defaults to `/apple-icon`; ensure
  that path serves a public PNG, or point it at one (SVG/data-URIs render poorly
  in email). It's excluded from the gate by the proxy matcher.

### 4 — Wire the app shell

In the layout that wraps authed pages: wrap children in `<AuthProvider>`, render
`<AccountMenu/>` in the header and `<PasskeyPrompt/>` above the main content, and
render the login route **without** app chrome. Minimal pattern:

```tsx
// the authed layout / shell (client component)
import { AuthProvider } from "@/components/auth/auth-context";
import { AccountMenu } from "@/components/auth/account-menu";
import { PasskeyPrompt } from "@/components/auth/passkey-prompt";
import { usePathname } from "next/navigation";

export function Shell({ children }) {
  const pathname = usePathname();
  if (pathname === "/login") return <>{children}</>;     // bare login
  return (
    <AuthProvider>
      <header>…<AccountMenu /></header>
      <main><PasskeyPrompt />{children}</main>
    </AuthProvider>
  );
}
```

(If there's no shared shell, drop `<AccountMenu/>` wherever your nav lives and
wrap that subtree in `<AuthProvider>`.)

### 5 — Provision backend + env

Generate the secret and assemble `.env.local` (copy from
`templates/.env.local.example`):

```bash
bash scripts/gen-secret.sh                                  # AUTH_JWT_SECRET=...
RESEND_API_KEY=re_xxx bash scripts/find-resend-domain.sh    # pick a verified domain
# If you have a Supabase management token, provision in one shot:
SUPABASE_ACCESS_TOKEN=sbp_xxx bash scripts/provision-supabase.sh <project-name> us-east-2
#   → prints SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (migration already applied)
```

Otherwise apply `supabase/0001_auth.sql` manually (Supabase SQL editor) and copy
the project URL + service-role key. Write all keys to `.env.local`, and set the
**same** vars in the host (e.g. `vercel env add <NAME> production`). `.env.local`
must be gitignored.

### 6 — Build + smoke test

```bash
npm run build
npx next start -p 3210 &           # then:
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3210/         # 307 → /login
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3210/login                    # 200
curl -s http://localhost:3210/api/auth/me                                               # {"authenticated":false}
curl -s -X POST -H 'content-type: application/json' -d '{"email":"stranger@x.com"}' \
  http://localhost:3210/api/auth/magic/start                                            # 403 if allow-listed
```
Then a real send to an allow-listed address returns `{"ok":true}` and delivers
the branded email. (Render the email by exporting `magicLinkHtml` and opening it
in a browser — see `reference/email-design.md`.)

## Customization

- **Gate scope** — to protect only some routes, narrow the `matcher` in
  `proxy.ts` (e.g. `['/app/:path*', '/login']`) instead of the catch-all.
- **Email design** — `reference/email-design.md`. Edit `brand.ts`, not the markup.
- **Session length** — `SESSION_MAX_AGE` in `config.ts` (default 30 days).
- **Multi-tenant / roles** — add a `role` column to `auth_users` and read it from
  the session by extending `signSession` / `SessionPayload`.

## Security notes

- Tokens: random 32-byte, base64url; only the SHA-256 **hash** is persisted;
  single-use; 15-min expiry; per-email rate limit (3 / 10 min).
- Sessions: HS256 JWT in an **httpOnly**, `SameSite=Lax`, `Secure`-in-prod cookie.
- Supabase: RLS on, **no policies** → anon key reads nothing; all access is via
  the server-only service-role key.
- WebAuthn challenges ride in short-lived signed cookies (no extra table).
- Remind the user to **rotate** any secret pasted into chat, and to set
  `AUTH_ALLOWED_EMAILS` for confidential apps.

## Gotchas

- `proxy.ts` (Next 16) vs `middleware.ts` (Next 15) — same body, different name.
- `cookies()` / `searchParams` are **async** in Next 15/16 (templates already
  `await` them).
- The matcher must exclude `api`, `_next/*`, and your icon/OG routes (it does).
- Route handlers run on the **nodejs** runtime (set in each file) — required for
  `@simplewebauthn/server`, `resend`, `@supabase/supabase-js`, and `crypto`.

See `reference/setup.md` for the full provisioning playbook and `reference/email-design.md` for the email anatomy.

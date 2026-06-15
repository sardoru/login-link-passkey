# login-link-passkey

> Drop a complete, tested **passwordless authentication** system into a Next.js App Router app — branded **magic-link email** (Resend) + **WebAuthn passkeys**, backed by **Supabase**, with the whole app gated at the edge.

This is a [Claude Code](https://claude.com/claude-code) **skill**. Invoke it from Claude Code with `/login-link-passkey` (or natural language like *"add magic-link auth"*, *"add passkeys"*, *"gate this app"*) and it scaffolds the auth engine into your project, optionally provisioning Supabase and locating a verified Resend domain along the way.

## What it installs

- **Edge gate** (`src/proxy.ts`, Next 16) — verifies a signed session (`jose`) on every request; unauthenticated users are routed to `/login`. Auth APIs and branding assets are excluded from the gate.
- **Magic links** — single-use, 15-minute tokens; only the **SHA-256 hash** is stored. Branded email via Resend. Allow-listed emails only, rate-limited.
- **Passkeys** — usernameless (discoverable) sign-in plus **one-tap registration with no nickname prompt** — "Add passkey" just works.
- **Supabase store** — `auth_users / auth_magic_links / auth_passkeys`, RLS on with **no policies** (default-deny); the server uses the service-role key only.
- **UI** — a `/login` screen, a top-bar account menu (add passkey / sign out), and a dismissible "add a passkey" prompt. Styled with portable CSS tokens.

## Prerequisites

1. **Next.js App Router** with the `@/* → ./src/*` tsconfig alias (the create-next-app default). Confirm `src/app/` exists.
2. **Tailwind v4** (the UI templates use it). If absent, restyle the three UI components or add Tailwind.
3. **`lucide-react`** for icons.
4. Secrets you supply: a **Resend API key**, and either a **Supabase management token** (`sbp_…`, which lets the skill provision everything) **or** an existing project's **URL + service-role key**.

## Usage (inside Claude Code)

```
/login-link-passkey --app "Acme" --from "Acme <login@acme.com>" --allow you@acme.com,team@acme.com --accent #C9A84C
```

All arguments are optional — the skill will ask for anything it needs. Under the hood it:

1. Gathers brand + config (app name, tagline, accent color, from-address, allow-list, site URL).
2. Installs dependencies: `resend @supabase/supabase-js @simplewebauthn/server @simplewebauthn/browser jose` (+ `lucide-react`).
3. Copies `templates/src/**` into your project and the SQL migration into `supabase/`.
4. Wires the app shell (`<AuthProvider>`, `<AccountMenu/>`, `<PasskeyPrompt/>`).
5. Sets the environment variables (see `templates/.env.local.example`).

See [`SKILL.md`](./SKILL.md) for the full procedure and [`reference/`](./reference) for setup and email-design notes.

## Environment variables

| Var | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL — magic-link base, email logo, WebAuthn origin/rpID |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** Supabase service-role key — never expose |
| `RESEND_API_KEY` | Resend API key for the branded magic-link email |
| `AUTH_EMAIL_FROM` | From address on a Resend-verified domain |
| `AUTH_JWT_SECRET` | Session + challenge signing secret (`openssl rand -base64 48`) |
| `AUTH_ALLOWED_EMAILS` | Comma-separated allow-list (empty = open; not recommended) |
| `AUTH_RP_ID` / `AUTH_RP_NAME` | Optional WebAuthn overrides (default: derived from request host) |

## Repository layout

```
SKILL.md                  # the skill definition (entry point for Claude Code)
reference/                # setup.md, email-design.md
scripts/                  # find-resend-domain.sh, gen-secret.sh, provision-supabase.sh
templates/                # the auth engine copied into your project
  src/lib/auth/**         #   config, brand, allowlist, tokens, session, db, email, webauthn, server
  src/app/api/auth/**     #   magic start/verify, passkey options/verify, logout, me
  src/proxy.ts            #   edge gate (Next 16; rename to middleware.ts for Next 15)
  src/components/**       #   login view, account menu, passkey prompt, brand mark
  supabase/0001_auth.sql  #   auth_users / auth_magic_links / auth_passkeys (+ RLS)
```

## Installing the skill

Clone into your Claude Code skills directory:

```bash
git clone https://github.com/sardoru/login-link-passkey.git ~/.claude/skills/login-link-passkey
```

Then it's available as `/login-link-passkey` in any Claude Code session.

## License

[MIT](./LICENSE)

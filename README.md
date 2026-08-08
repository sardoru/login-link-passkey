# login-link-passkey

> Drop a complete, tested **passwordless authentication** system into a Next.js App Router app — branded **magic-link email** (Resend) + **WebAuthn passkeys**, backed by **Supabase**, gated at the edge — together with the **admin dashboard that decides who gets in**: a role/permission matrix, invites, access codes, and a waitlist.

This is a [Claude Code](https://claude.com/claude-code) **skill**. Invoke it with `/login-link-passkey` (or natural language like *"add magic-link auth"*, *"add passkeys"*, *"gate this app"*, *"add user management"*, *"roles and permissions"*) and it scaffolds the whole system into your project, optionally provisioning Supabase and locating a verified Resend domain along the way.

Verified against **Next 16 / React 19**: `next build` clean with zero warnings, every route typechecked, OG cards rendered as real PNGs. See [`CHANGELOG.md`](./CHANGELOG.md).

## What it installs

### Auth core

- **Edge gate** (`src/proxy.ts`, Next 16) — verifies a signed session (`jose`) on every request; unauthenticated users are routed to `/login`. Auth APIs, OG images, and the public entrances are excluded.
- **Magic links** — single-use, 15-minute tokens; only the **SHA-256 hash** is stored. Branded email via Resend. Rate-limited.
- **Passkeys** — usernameless (discoverable) sign-in plus **one-tap registration with no nickname prompt** — "Add passkey" just works.

### Access control

- **Admin dashboard** at `/admin` — Users · Roles · Invites · Access codes · Waitlist · Audit. Every tab is permission-filtered; you never see a page you'd be bounced from.
- **Permission matrix** — an 18-key capability catalog, an editable **role × permission grid**, and a **per-user tri-state override** (inherit / grant / deny) layered on top. Only deltas are stored, so editing a role still moves everyone who inherits it.
- **Add a user** (name + email + role) → creates the account and sends a branded **welcome email** through your Resend key.
- **Invite links** — single-use, **expire in 3 days**. Bound to an email (accepting signs them straight in) or open (they confirm their address first). Revocable.
- **Access codes** — one shareable code worth **N seats** (default 10, any number), optional expiry, **revocable**, with a redemption list.
- **Waitlist** — a public `/waitlist` page; admins approve into a role, which provisions the account and emails the invite.
- **Audit log** — append-only record of every admin action.

### Presentation

- **Custom OG cards** — branded 1200×630 images on `/login`, `/invite/[token]` (personalized with the invitee's first name), `/join`, and `/waitlist`, with matching `twitter-image` routes.
- **UI** — login screen, four public entrances sharing one shell, account menu (add passkey / admin link / sign out), and a dismissible "add a passkey" prompt. Styled with portable CSS tokens.

### Store

**Supabase** — `auth_users`, `auth_magic_links`, `auth_passkeys`, `auth_roles`, `auth_invites`, `auth_access_codes`, `auth_access_code_uses`, `auth_waitlist`, `auth_audit_log`. RLS on with **no policies** (default-deny); the server uses the service-role key only.

## How authorization works

Three layers, one source of truth:

| Layer | Reads | Enforces |
| --- | --- | --- |
| `src/proxy.ts` (edge) | the `perms` claim in the session JWT | routing only |
| `/admin` layout | the database | whether the dashboard renders |
| `/api/admin/**` | the database | **the real gate** — every mutation |

A stale token is harmless: at worst it renders an admin shell that then refuses every action. `/api/auth/me` re-signs the cookie whenever the database disagrees, so a role change takes effect on the user's next page load — no sign-out required.

Escalation is blocked in both directions: you can't assign a role, grant a permission, or mint a role holding capabilities you don't have yourself, and the last active owner can't be demoted, suspended, or deleted.

## Prerequisites

1. **Next.js App Router** with the `@/* → ./src/*` tsconfig alias (the create-next-app default). Confirm `src/app/` exists.
2. **Tailwind v4** (the UI templates use it). If absent, restyle the components or add Tailwind.
3. **`lucide-react`** for icons.
4. Secrets you supply: a **Resend API key**, and either a **Supabase management token** (`sbp_…`, which lets the skill provision everything) **or** an existing project's **URL + service-role key**.

## Usage (inside Claude Code)

```
/login-link-passkey --app "Acme" --from "Acme <login@acme.com>" --owner you@acme.com --accent #C9A84C
```

All arguments are optional — the skill asks for anything it needs. Under the hood it:

1. Gathers brand + config (app name, tagline, accent color, from-address, owner email, site URL).
2. Installs dependencies: `resend @supabase/supabase-js @simplewebauthn/server @simplewebauthn/browser jose` (+ `lucide-react`).
3. Copies `templates/src/**` into your project and both SQL migrations into `supabase/`.
4. Wires the app shell (`<AuthProvider>`, `<AccountMenu/>`, `<PasskeyPrompt/>`).
5. Sets the environment variables (see `templates/.env.local.example`).

> **Set `AUTH_BOOTSTRAP_OWNERS` before your first sign-in.** That address is promoted to `owner` when it logs in — it's how `/admin` becomes reachable. Without it, nobody can administer the app.

Flags: `--no-admin` and `--no-waitlist` trim the scaffold if you only want the auth core.

See [`SKILL.md`](./SKILL.md) for the full procedure, [`reference/admin.md`](./reference/admin.md) for the permission catalog, data model, and API table, and [`reference/`](./reference) for setup and email-design notes.

## Environment variables

| Var | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL — link base, WebAuthn origin/rpID, OG `metadataBase` |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** service-role key — never expose |
| `RESEND_API_KEY` | Resend key — used for magic links, invites, and waitlist mail |
| `AUTH_EMAIL_FROM` | From address on a Resend-verified domain |
| `AUTH_JWT_SECRET` | Session + challenge signing secret (`openssl rand -base64 48`) |
| `AUTH_ALLOWED_EMAILS` | Comma-separated allow-list (empty = open). Known users are always allowed |
| `AUTH_BOOTSTRAP_OWNERS` | Emails promoted to `owner` on first sign-in — **set this or `/admin` is unreachable** |
| `AUTH_INVITE_TTL_DAYS` | Optional. Invite-link lifetime, default `3` |
| `AUTH_CODE_DEFAULT_USES` | Optional. Default seats on a new access code, default `10` |
| `AUTH_WAITLIST_ENABLED` | Optional. `false` 404s `/waitlist` and refuses the API |
| `AUTH_RP_ID` / `AUTH_RP_NAME` | Optional WebAuthn overrides (default: derived from request host) |

## Repository layout

```
SKILL.md                       # the skill definition (entry point for Claude Code)
CHANGELOG.md                   # version history, verification notes, known limits
reference/                     # admin.md, setup.md, email-design.md
scripts/                       # find-resend-domain.sh, gen-secret.sh, provision-supabase.sh
templates/                     # everything copied into your project
  src/lib/auth/**              #   engine: config, brand, session, db, webauthn, server
                               #   access control: permissions, rbac, admin-db, invites
                               #   mail: email, email-shell, email-invite
  src/lib/og/auth-og.tsx       #   shared OG card renderer
  src/app/api/auth/**          #   magic start/verify, passkey, logout, me,
                               #   invite accept, access-code redeem
  src/app/api/admin/**         #   users, roles, invites, access-codes, waitlist, audit
  src/app/admin/**             #   dashboard shell + six tabs
  src/app/{login,invite,join,waitlist}/**   #   public entrances + their OG cards
  src/components/admin/**      #   dashboard UI + the permission matrices
  src/components/{views,auth}/**            #   public screens + client auth UI
  src/proxy.ts                 #   edge gate (Next 16; rename to middleware.ts for Next 15)
  supabase/0001_auth.sql       #   users / magic links / passkeys (+ RLS)
  supabase/0002_admin.sql      #   roles / invites / codes / waitlist / audit (additive)
```

`0002_admin.sql` is additive and idempotent — safe to run on a project already carrying `0001` with live users.

## Security notes

- Tokens are random 32-byte base64url; only the **SHA-256 hash** is persisted. Magic links last 15 minutes, invites 3 days, both single-use.
- **Access codes are stored in plaintext** — they're meant to be shared. That's safe because redeeming one never issues a session: it claims a seat, creates the account as `invited`, and emails a magic link to prove the address. A leaked code can burn seats (revoke it), not impersonate anyone.
- Seat claiming is a compare-and-swap on `uses`, so concurrent redemptions can't oversell the last seat. Invites are claimed before the account is created, so a lost race never provisions a user.
- Sessions are HS256 JWTs in an **httpOnly**, `SameSite=Lax`, `Secure`-in-prod cookie.
- The waitlist API always answers `{ok:true}` for a valid address (no account enumeration) and carries a honeypot field.

## Installing the skill

```bash
git clone https://github.com/sardoru/login-link-passkey.git ~/.claude/skills/login-link-passkey
```

Then it's available as `/login-link-passkey` in any Claude Code session.

## License

[MIT](./LICENSE)

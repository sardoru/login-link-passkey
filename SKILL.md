---
name: login-link-passkey
description: >-
  Add passwordless authentication — a branded magic-link email (Resend + Supabase)
  plus Apple / WebAuthn passkeys — to a Next.js App Router app, gate the whole
  app behind it, and ship the admin dashboard that manages who gets in. Drops in
  a tested auth engine (jose sessions, an edge proxy gate, single-use SHA-256-hashed
  links), a beautifully designed (non-bland) Resend email, one-tap "Add passkey"
  with NO device-name prompt, multi-passkey management (list / add another /
  remove, self-service and from the admin panel — including enrolling a passkey
  for a user in person or emailing them a setup link), plus user management with
  a granular per-user and per-role permission matrix,
  add-user-and-send-welcome-email, 3-day invite links, multi-seat revocable
  access codes, a public waitlist, and custom OG cards on every login/invite
  link. Use when the user says 'add login', 'magic link auth', 'passwordless
  auth', 'add passkeys', 'manage passkeys', 'delete a passkey', 'gate this app',
  'login-link-passkey', 'add authentication', 'admin dashboard', 'user
  management', 'roles and permissions', 'invite users', 'invite links', 'access
  codes', or 'waitlist'.
argument-hint: '[--app "App Name"] [--from "Name <login@domain>"] [--owner you@x.com] [--accent #HEX] [--no-admin] [--no-waitlist]'
user-invocable: true
tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

# login-link-passkey — Magic-link + Passkey auth, with an access-control dashboard

Drop a complete, tested passwordless-auth system into a **Next.js App Router**
project: branded **magic-link email** (Resend) + **WebAuthn passkeys**, backed by
**Supabase**, with the entire app gated at the edge — plus the **admin dashboard**
that decides who gets in and what they can do.

Everything here is verified against Next 16 / React 19: `next build` clean, all
routes typecheck, OG cards render as real PNGs.

## What it installs

**Auth core**

- **Edge gate** (`src/proxy.ts`, Next 16) — verifies a signed session (jose) on
  every request; unauthenticated users go to `/login`. Auth APIs, OG images, and
  the public entrances are excluded.
- **Magic links** — single-use, 15-min tokens; only the **SHA-256 hash** is
  stored. Branded email via Resend. Rate-limited.
- **Passkeys** — usernameless (discoverable) sign-in + **one-tap registration
  with no nickname prompt**. Labels are derived ("iPhone · Safari", "Windows
  Hello", "Security key"), never typed.
- **Passkey management** — the account menu opens **Your passkeys**: every
  credential on the account with device label, synced badge, added / last-used
  dates; **add another** or **remove** any of them (removing the last one is
  allowed — the magic link always remains). Admins get the same list per user
  in `/admin/users`, plus **remove**, **add on this device** (in-person /
  kiosk enrolment) and **email setup link** (a single-use magic link that lands
  on the one-tap prompt on *their* device — the only way to enrol someone
  remotely, since WebAuthn can't register a credential on hardware you don't
  hold).

**Access control**

- **Admin dashboard** at `/admin` — Users · Roles · Invites · Access codes ·
  Waitlist · Audit. Every tab is permission-filtered; you never see a page
  you'd be bounced from.
- **Permission matrix** — a catalog of capability keys, a role × permission grid
  you edit in the UI, and a **per-user tri-state override** (inherit / grant /
  deny) layered on top. Only deltas are stored, so editing a role still moves
  everyone who inherits it.
- **Add a user** (name + email + role) → creates the account and sends a branded
  **welcome/invite email** through the project's Resend key.
- **Invite links** — single-use, **expire in 3 days**. Bound to an email
  (accepting signs them straight in) or open (they confirm their address first).
- **Access codes** — one shareable code worth **N seats (default 10, any number)**,
  optional expiry, **revocable**, with a redemption list.
- **Waitlist** — public `/waitlist` page; admins approve into a role, which
  provisions the account and emails the invite.
- **Audit log** — append-only record of every admin action.

**Custom OG cards** — branded 1200×630 images on `/login`, `/invite/[token]`
(personalized with the invitee's first name), `/join`, and `/waitlist`, with
matching `twitter-image` routes.

**Supabase store** — `auth_users / auth_magic_links / auth_passkeys / auth_roles /
auth_invites / auth_access_codes / auth_access_code_uses / auth_waitlist /
auth_audit_log`, RLS on with **no policies** (default-deny); the server uses the
service-role key only. Three migrations: `0001_auth`, `0002_admin`,
`0003_passkeys` (device metadata + `users.passkeys` grant) — all additive and
idempotent.

## Prerequisites (verify first)

1. **Next.js App Router** with the `@/* → ./src/*` tsconfig alias (default
   create-next-app). Confirm `src/app/` exists.
2. **Tailwind v4** (the UI templates use it). If absent, restyle the components
   or add Tailwind.
3. **`lucide-react`** for icons (installed below if missing).
4. Secrets the user must supply: a **Resend API key**, and either a **Supabase
   management token** (`sbp_…`, lets this skill provision everything) OR an
   existing project's **URL + service-role key**.

## Procedure

### 1 — Gather brand + config

Ask (or take from args) and keep concise:
- **App name** + **tagline** (wordmark + email + OG cards), **accent color** (hex).
- **From address** — must be on a Resend-verified domain
  (`scripts/find-resend-domain.sh`; falls back to `onboarding@resend.dev` which
  only delivers to the key owner).
- **Owner email** — bootstrapped to the `owner` role on first sign-in
  (`AUTH_BOOTSTRAP_OWNERS`). Without one, nobody can reach `/admin`.
- **Site URL** (canonical; link base + WebAuthn origin + OG `metadataBase`).
- Whether the app wants the **waitlist** and **access codes** (both can be
  dropped — see Customization).

### 2 — Install dependencies

```bash
npm install resend @supabase/supabase-js @simplewebauthn/server @simplewebauthn/browser jose
npm install lucide-react   # if not already present
```

### 3 — Copy templates into the project

Copy `templates/src/**` → the project's `src/**` (preserve structure), and
`templates/supabase/000*.sql` → `supabase/migrations/`. File map:

| Template | Purpose |
| --- | --- |
| `src/lib/auth/{config,brand,allowlist,tokens,session,db,webauthn,server}.ts` | Auth engine + brand |
| `src/lib/auth/{passkey-registration,passkey-admin}.ts` | Shared WebAuthn registration ceremony; admin passkey guards |
| `src/lib/auth/{permissions,rbac,admin-db,invites}.ts` | Permission catalog, guards, admin queries, invite/code tokens |
| `src/lib/auth/{email,email-shell,email-invite}.ts` | Resend sends: magic link, invite/welcome, waitlist |
| `src/lib/og/auth-og.tsx` | Shared OG card renderer |
| `src/app/api/auth/**` | magic start/verify, passkey options/verify, **passkeys list/delete**, logout, me, invite accept, access-code redeem |
| `src/app/api/admin/**` | users (+ **`[id]/passkeys` list/delete/options/verify/setup-link**), roles, invites, access-codes, waitlist, audit |
| `src/app/api/waitlist/route.ts` | Public waitlist signup |
| `src/proxy.ts` | Edge gate (Next 16) |
| `src/app/{login,invite/[token],join,waitlist}/**` | Public entrances + their OG/Twitter cards |
| `src/app/admin/**` | Dashboard shell + six tabs |
| `src/components/views/{auth-shell,login,invite,join,waitlist}.tsx` | Public screens |
| `src/components/admin/**` | Dashboard UI (ui primitives, panels, permission matrix, **passkeys modal**) |
| `src/components/auth/**`, `src/components/brand-mark.tsx` | Client auth UI (account menu, passkey prompt, **passkey manager**) |
| `src/styles/auth-tokens.css` | Color tokens for the UI |

Then:
- **Brand** — edit `src/lib/auth/brand.ts` (name, tagline, colors, logo, footer).
  This drives the login screen, all three emails, and every OG card.
- **Tokens** — paste `src/styles/auth-tokens.css` into `globals.css` *after*
  `@import "tailwindcss";`. Set `--brass` (light + dark) to the accent color.
- **Next 15?** Rename `src/proxy.ts` → `src/middleware.ts` and
  `export function proxy` → `export function middleware` (keep the `config`).
- **Email logo** — `brand.ts → email.logoUrl` defaults to `/apple-icon`; ensure
  that path serves a public PNG.
- **Permissions** — add project capabilities by appending to `PERMISSIONS` in
  `src/lib/auth/permissions.ts`; they appear in the matrix automatically.

### 4 — Wire the app shell

Wrap authed pages in `<AuthProvider>`, render `<AccountMenu/>` in the header
(it shows an **Admin dashboard** link to anyone holding `admin.access`) and
`<PasskeyPrompt/>` above the main content. Render public routes without chrome:

```tsx
"use client";
import { AuthProvider } from "@/components/auth/auth-context";
import { AccountMenu } from "@/components/auth/account-menu";
import { PasskeyPrompt } from "@/components/auth/passkey-prompt";
import { usePathname } from "next/navigation";

const BARE = ["/login", "/invite", "/join", "/waitlist"];

export function Shell({ children }) {
  const pathname = usePathname();
  if (BARE.some((p) => pathname.startsWith(p))) return <>{children}</>;
  return (
    <AuthProvider>
      <header>…<AccountMenu /></header>
      <main><PasskeyPrompt />{children}</main>
    </AuthProvider>
  );
}
```

`/admin` brings its own layout and nav — don't wrap it in app chrome.

Gate UI on permissions with the context helper:

```tsx
const { can } = useAuth();
{can("users.write") && <InviteButton />}   // cosmetic only — the server re-checks
```

### 5 — Provision backend + env

```bash
bash scripts/gen-secret.sh                                  # AUTH_JWT_SECRET=...
RESEND_API_KEY=re_xxx bash scripts/find-resend-domain.sh    # pick a verified domain
SUPABASE_ACCESS_TOKEN=sbp_xxx bash scripts/provision-supabase.sh <project-name> us-east-2
#   → creates the project, applies BOTH migrations, prints URL + service-role key
```

Otherwise apply `0001_auth.sql`, `0002_admin.sql`, then `0003_passkeys.sql` in the
Supabase SQL editor. **Upgrading a live install from before 2026-08-17?** Run
`0003_passkeys.sql` alone — it only adds columns and grants `users.passkeys` to
the seeded `admin` role.
Write all keys to `.env.local` (template: `templates/.env.local.example`) and set
the same vars in the host (`vercel env add <NAME> production`). `.env.local` must
be gitignored.

**Set `AUTH_BOOTSTRAP_OWNERS=you@example.com` before the first sign-in** — that
address is promoted to `owner` when it logs in, which is how `/admin` becomes
reachable. Remove the var once the owner exists.

### 6 — Build + smoke test

```bash
npm run build
npx next start -p 3210 &
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3210/        # 307 → /login
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3210/admin   # 307 → /login?next=/admin
for p in /login /join /waitlist /invite/xyz; do
  curl -s -o /dev/null -w "$p %{http_code}\n" "http://localhost:3210$p"                # 200
done
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" \
  http://localhost:3210/login/opengraph-image                                          # 200 image/png
curl -s http://localhost:3210/api/auth/me                                              # {"authenticated":false}
curl -s -X POST -H 'content-type: application/json' -d '{"email":"stranger@x.com"}' \
  http://localhost:3210/api/auth/magic/start                                           # 403 if allow-listed
```

Then sign in as the bootstrap owner, open `/admin`, and verify the round trip:
add a user → the welcome email arrives → the invite link works → the new user
appears with the right role. Then the passkey round trip: account menu → **Add a
passkey** → **Passkeys 1** → add another → remove one; in `/admin/users` open a
row's fingerprint button → **Email setup link** → the mail arrives → opening it
on a phone lands on the forced one-tap prompt.

## How authorization works

Three layers, one source of truth:

1. **Edge proxy** reads the permission snapshot in the session JWT — fast, and
   only decides *routing*.
2. **`/admin` layout** calls `currentActor()`, which re-reads role + overrides
   from the database.
3. **Every `/api/admin` route** calls `requirePermission(...)` before touching
   data. This is what actually enforces access.

So a stale token is harmless: it might render an admin shell that then refuses
every action. `/api/auth/me` re-signs the cookie whenever the DB disagrees, so a
role change takes effect on the user's next page load — no sign-out needed.

Escalation is blocked in both directions: you can't assign a role, grant a
permission, or mint a role holding capabilities you don't have yourself, and the
last active owner can't be demoted, suspended, or deleted.

## Passkey management — how it works

- **Self-service** — `AccountMenu` shows *Add a passkey* until one exists, then
  *Passkeys · n*, which opens `PasskeyManager` (`GET /api/auth/passkeys`,
  `DELETE /api/auth/passkeys/[id]`, both scoped to the session's user id).
  Registration always excludes the credentials the account already holds, so a
  second passkey on the same authenticator is refused by the platform, not by us.
- **Admin** — the fingerprint button on every `/admin/users` row opens
  `PasskeysModal`. Viewing needs `users.read`; remove / add / setup-link need the
  new **`users.passkeys`** capability (sensitive; seeded into `admin`, `owner`
  has `*`).
- **Add on this device** runs the WebAuthn ceremony in the admin's browser with
  the *target's* user handle — for handing a phone to a colleague or seeding a
  shared kiosk. The resulting credential signs in **as the target**, so it's
  guarded by `canConferRole` (you can't enrol for a role above your own; owners
  bypass), refused for suspended accounts, and audited as `passkey.enrolled`
  with `created_by` recorded on the row (shown as "admin-enrolled").
- **Email setup link** mints a single-use 15-min magic link with
  `next=PASSKEY_SETUP_PATH` (default `/?passkey=setup`). After sign-in,
  `<PasskeyPrompt/>` sees `?passkey=setup` and opens even if the user dismissed
  it before or already has a passkey; it strips the param on success. If your
  proxy matcher is narrowed so `/` doesn't render `<PasskeyPrompt/>`, point
  `AUTH_PASSKEY_SETUP_PATH` at an authed page that does.
- **Deleting** never signs anyone out — sessions are JWTs — it only stops that
  authenticator from completing a future passkey sign-in. Deleting a user still
  cascades to their passkeys.

## Customization

- **Gate scope** — narrow the `matcher` in `proxy.ts` to protect only some routes.
- **Passkey setup landing** — `AUTH_PASSKEY_SETUP_PATH` (default `/?passkey=setup`).
- **Drop the waitlist** — set `AUTH_WAITLIST_ENABLED=false` (page 404s, API
  refuses), and remove the link from `views/login.tsx`.
- **Drop access codes** — delete `app/join/**`, `api/auth/access-code`,
  `components/admin/access-codes-panel.tsx`, and its nav entry + link.
- **Invite lifetime** — `AUTH_INVITE_TTL_DAYS` (default 3).
- **Default seats** — `AUTH_CODE_DEFAULT_USES` (default 10).
- **Email design** — `reference/email-design.md`. Edit `brand.ts`, not the markup;
  all emails share `email-shell.ts`.
- **OG cards** — `src/lib/og/auth-og.tsx`; per-page copy lives in each
  `opengraph-image.tsx`.
- **Session length** — `SESSION_MAX_AGE` in `config.ts` (default 30 days).

## Security notes

- Tokens: random 32-byte, base64url; only the SHA-256 **hash** is persisted;
  single-use; magic links 15 min, invites 3 days.
- **Access codes are stored in plaintext** — they're meant to be shared. That's
  safe because redeeming one never issues a session: it claims a seat, creates
  the account as `invited`, and emails a magic link to prove the address. A
  leaked code can burn seats (revoke it), not impersonate anyone.
- Seat claiming is a compare-and-swap on `uses`, so concurrent redemptions can't
  oversell the last seat. Invites are claimed before the account is created, so
  a lost race never provisions a user.
- Sessions: HS256 JWT in an **httpOnly**, `SameSite=Lax`, `Secure`-in-prod cookie.
- **Passkeys**: the self-service delete route filters by `user_id` as well as
  id, so a guessed id can't touch someone else's credential. Admin on-behalf
  enrolment is the one place a credential is minted for another person — it is
  gated by `users.passkeys` + role conferral, refused for suspended accounts,
  bound to a challenge cookie that carries both the target and the acting admin
  (the self-service verify route rejects any challenge that has a `by` claim),
  and audited. Removing every passkey is allowed because the magic link is
  always a way back in.
- Supabase: RLS on, **no policies** → the anon key reads nothing; all access is
  through the server-only service-role key.
- The waitlist API always answers `{ok:true}` for a valid address (no account
  enumeration) and carries a honeypot field.
- Remind the user to **rotate** any secret pasted into chat.

## Gotchas

- `proxy.ts` (Next 16) vs `middleware.ts` (Next 15) — same body, different name.
- The matcher must exclude **`.*opengraph-image` and `.*twitter-image`** — nested
  routes like `/login/opengraph-image` would otherwise be gated, and Slack /
  iMessage / X fetch them with no session, so previews would silently break.
- `runtime` in a `twitter-image.tsx` must be **declared, not re-exported** —
  Next reads it statically and warns "can't recognize the exported `runtime`
  field", then falls back to the default.
- Set **`metadataBase`** on every public page (the templates do) or Next warns
  and emits relative OG URLs that unfurlers reject.
- `next/og` is a **Satori** subset: flexbox only, no grid, every element needs an
  explicit `display`, and a gradient is clipped to its box — the brass wash lives
  inside a `borderRadius: 9999` circle for exactly that reason.
- `cookies()` / `searchParams` / `params` are **async** in Next 15/16 (templates
  already `await` them).
- Route handlers run on the **nodejs** runtime (set in each file) — required for
  `@simplewebauthn/server`, `resend`, `@supabase/supabase-js`, and `crypto`.
- `upsertUser` only writes the fields you pass, so signing in never clobbers a
  name or demotes a role set in the dashboard.
- **Adding a permission key does not grant it to already-seeded roles** — the
  `auth_roles` rows were written before the key existed. `0003_passkeys.sql`
  handles `users.passkeys` for `admin`; any *project* key you add still needs a
  manual grant in `/admin/roles` (`owner` holds `*` and is fine).
- `InvalidStateError` from `startRegistration` means the authenticator already
  holds a credential for this account (we pass `excludeCredentials`) — the UI
  says so; it isn't a bug.

See `reference/admin.md` for the permission catalog, data model, and API
reference; `reference/setup.md` for the provisioning playbook; and
`reference/email-design.md` for the email anatomy.

## Changelog

Version history, verification notes, and known limits live in
[`CHANGELOG.md`](./CHANGELOG.md). Session transcripts are in `docs/`.

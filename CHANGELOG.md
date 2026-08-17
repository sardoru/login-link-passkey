# Changelog — `/login-link-passkey`

All notable changes to this skill. Newest first. Format follows
[Keep a Changelog](https://keepachangelog.com/); this skill ships templates
rather than a versioned package, so entries are grouped by date.

---

## 2026-08-17 — Passkey management: delete, add more, and admin enrolment

Passkeys stopped being a one-shot "Add passkey → Passkey enabled" flag. Users
manage every credential on their account, and admins can remove a passkey,
enrol one in person, or email a setup link from the Users tab.

### Added

- **`PasskeyManager`** (`components/auth/passkey-manager.tsx`) — opened from
  the account menu (*Passkeys · n*): lists every passkey with a derived device
  label, a **synced** badge for multi-device credentials, added / last-used
  dates, and an "admin-enrolled" tag; **Add another passkey** and per-row
  **Remove** (confirm dialog warns when it's the last one). Styled with the auth
  tokens only, so it ships in `--no-admin` installs.
- **Self-service API** — `GET /api/auth/passkeys`, `DELETE /api/auth/passkeys/[id]`
  (scoped to the session's `user_id`; audited as `passkey.self_deleted`).
- **`PasskeysModal`** (`components/admin/passkeys-modal.tsx`) — the fingerprint
  button on every `/admin/users` row (now shows the count) opens the user's
  passkey list. With `users.passkeys`: **Remove**, **Add on this device**
  (in-person / kiosk enrolment, WebAuthn ceremony in the admin's browser bound
  to the target user), and **Email setup link** (single-use magic link landing
  on the forced one-tap prompt on *their* device — the only remote option,
  because WebAuthn can't register a credential on hardware you don't hold). The
  URL is returned for copy-paste when email fails.
- **Admin API** — `GET|/api/admin/users/[id]/passkeys`,
  `DELETE …/passkeys/[passkeyId]`, `POST …/passkeys/options` + `/verify`,
  `POST …/passkeys/setup-link`.
- **`users.passkeys`** permission (Users group, sensitive). Seeded into `admin`
  by `0003` (and in the `0002` seed for fresh installs); `owner` has `*`.
- **`0003_passkeys.sql`** — `auth_passkeys` gains `label`, `device_type`,
  `backed_up`, `aaguid`, `created_by`; grants `users.passkeys` to the seeded
  `admin` role. Additive + idempotent; safe on live projects.
- **Derived passkey labels** (`deviceLabelFromRequest`) — "iPhone · Safari",
  "Mac · Chrome", "Windows Hello", "Security key · Mac" — from the UA and the
  authenticator attachment. Still **no nickname prompt**.
- **`sendPasskeySetupEmail`** / `passkeySetupHtml` on the shared email shell.
- **`AUTH_PASSKEY_SETUP_PATH`** (default `/?passkey=setup`) — where the setup
  link lands; must render `<PasskeyPrompt/>`.
- `passkey-registration.ts` (shared ceremony for self + admin routes) and
  `passkey-admin.ts` (`passkeyTarget` guard).
- `passkey-client.ts`: `enrollPasskeyForUser`, `listMyPasskeys`,
  `removeMyPasskey`, `passkeyLabel`, `fmtPasskeyDate`; `addPasskey()` now
  returns the derived `label`.

### Changed

- **`AccountMenu`** — *Passkey enabled* (static) → **Passkeys · n** (opens the
  manager); *Add a passkey* stays until the first one exists, with a small
  *Manage passkeys…* link underneath.
- **`PasskeyPrompt`** honours `?passkey=setup`: opens even if previously
  dismissed or a passkey already exists, uses "your admin sent you here" copy,
  and strips the param on success. A dismissal in that mode is not remembered.
- **`/api/auth/me`** returns `passkeyCount` alongside `hasPasskey`.
- **`/api/auth/passkey/register/*`** rewritten on the shared helper; `verify`
  now rejects any challenge carrying an admin `by` claim.
- **`UsersPanel`** takes `canPasskeys` + `selfId`; the inline fingerprint next
  to the name is replaced by the action button. `users/page.tsx` passes both.
- `db.ts`: `PasskeyInfo`, `listPasskeyInfo`, `getPasskeyInfo`, `deletePasskey`;
  `createPasskey` accepts the new metadata.
- `provision-supabase.sh` applies all three migrations.

### Security

- Self-service delete filters by `user_id` **and** id.
- On-behalf enrolment mints a credential that signs in as someone else, so it is
  gated by `users.passkeys` + `canConferRole` (no enrolling above your own role;
  owners bypass; your own row always allowed), refused for suspended accounts,
  tied to a challenge cookie that names both target and admin, and audited
  (`passkey.enrolled`, `created_by` on the row).
- Removing every passkey is permitted: the magic link is always a way back in,
  and a stolen-device story ("remove it now") must not be blocked.
- Deleting a passkey does not revoke sessions (they're JWTs) — documented.

### Verified

Templates copied into a fresh Next 16.3.1 / React 19.2 app
(`create-next-app --ts --tailwind --app --src-dir`) with real deps
(`@simplewebauthn/server 13.3`, `jose 6`, `resend 6`, `supabase-js 2.112`):

- `tsc --noEmit` clean; `next build` clean, **zero warnings**, 44 routes
  emitted incl. the 7 new passkey routes; proxy detected.
- `next start` smoke: all nine passkey endpoints (self-service list/delete,
  register options/verify, admin list/delete/options/verify/setup-link) answer
  **401** with no session; `/?passkey=setup` → 307 `/login` when signed out.
- `eslint src` — the four pre-existing `react-hooks/set-state-in-effect`
  baseline hits (`ui.tsx`, `auth-context`, `passkey-prompt`, `roles-panel`)
  and two unused-import warnings; **no new findings** from this work.
- The WebAuthn ceremonies themselves need a real browser + authenticator and
  were not exercised in CI; the routes reuse the previously verified
  `verifyRegistrationResponse` path unchanged.

### Known / open

- The GitHub repo (`sardoru/login-link-passkey`) is the source of truth for
  the skill; `~/.claude/skills/login-link-passkey` is a plain copy — keep them
  in sync by pulling the repo into the skills dir.
- `/intake-portal-login` still carries its own template copy and does not get
  passkey management automatically.
- No per-passkey rename (by design — labels are derived); no "sign out other
  sessions" — sessions are stateless JWTs.

---

## 2026-08-08 — Admin dashboard, RBAC, invites, access codes, waitlist, OG cards

The skill grew from "add passwordless auth" to "add passwordless auth **and the
access-control dashboard that decides who gets in**."

### Added

- **Admin dashboard** (`/admin`) — six permission-filtered tabs: Users · Roles ·
  Invites · Access codes · Waitlist · Audit. Tabs a user can't use are never
  rendered.
- **Permission system** (`src/lib/auth/permissions.ts`) — an 18-key capability
  catalog grouped by area, pure/edge-safe so the proxy, server, and client all
  share one evaluator. `effective = role ∪ user.grant − user.deny`.
- **Role matrix** (`/admin/roles`) — roles as columns, capabilities as rows,
  click a cell to toggle; each role saves independently. Seeded roles:
  `owner` (`["*"]`), `admin`, `manager`, `member`. Custom roles can be created
  and deleted (only when unheld); system roles are locked from deletion.
- **Per-user permission matrix** — tri-state **inherit / grant / deny** over the
  role. Only deltas are persisted, so editing a role still moves everyone who
  inherits it.
- **Add a user** — name + email + role, creates the account as `invited` and
  sends a branded welcome email through the project's Resend key; the invite URL
  is returned so an admin can copy it when delivery fails.
- **Invite links** — single-use, **3-day** expiry (`AUTH_INVITE_TTL_DAYS`).
  *Bound* (email supplied → accepting signs them straight in) or *open*
  (recipient supplies an address and verifies it by magic link first). Revocable.
- **Access codes** — shareable Crockford-base32 codes (`ACME-7K2P-QX9M`, no
  I/L/O/U) worth **N seats, default 10**, any number selectable, optional
  expiry, **revocable**, with a per-code redemption list.
- **Waitlist** — public `/waitlist` page + API with a honeypot; admins approve
  into a role, which provisions the account and emails a 3-day invite.
- **Audit log** — append-only record of every admin action (`/admin/audit`).
- **Custom OG cards** — branded 1200×630 images for `/login`,
  `/invite/[token]` (personalized with the invitee's first name when the token
  is live), `/join`, and `/waitlist`, plus matching `twitter-image` routes.
  Shared renderer: `src/lib/og/auth-og.tsx`.
- **Public entrances** — `/invite/[token]`, `/join`, `/waitlist`, all sharing a
  new `AuthShell` so they're visually identical to `/login`.
- **`0002_admin.sql`** — `auth_roles`, `auth_invites`, `auth_access_codes`,
  `auth_access_code_uses`, `auth_waitlist`, `auth_audit_log`, plus new columns on
  `auth_users` (`name`, `role`, `status`, `permissions`, `invited_by/at`,
  `notes`). Additive and idempotent — safe to run on a project already carrying
  0001 with live users.
- **`AUTH_BOOTSTRAP_OWNERS`** — emails promoted to `owner` on first sign-in, so
  the first admin exists without running SQL.
- **`reference/admin.md`** — permission catalog, data model, flows, API table,
  Satori constraints, bootstrap instructions.

### Changed

- **Session payload** now carries `name`, `role`, and a `perms` snapshot.
  Backwards compatible — all three are optional on verify.
- **`/api/auth/me`** re-reads permissions from the database on every call and
  **re-signs the cookie when it has drifted**, so a role change lands on the
  user's next page load with no sign-out.
- **`upsertUser`** only writes the fields passed to it, so signing in can no
  longer clobber a name or demote a role set in the dashboard.
- **Allow-list** — `isSignInAllowed()` also admits anyone already created,
  invited, or admitted by an access code, so `AUTH_ALLOWED_EMAILS` no longer has
  to be edited for every new person.
- **Emails** refactored onto a shared `email-shell.ts`; `email.ts` exposes a
  single `send()` that is the only place the Resend key is used.
- **`AccountMenu`** shows name, role, and an **Admin dashboard** link to anyone
  holding `admin.access`; `useAuth()` gained a `can()` helper for conditional UI.
- **`provision-supabase.sh`** applies both migrations in order.
- **Login screen** links to `/join` and `/waitlist`, and offers "Request access"
  when an address is refused.

### Fixed

- **Proxy matcher gated nested OG routes.** `/login/opengraph-image` and friends
  were caught by the catch-all, so Slack / iMessage / X — which fetch with no
  session — would have gotten a redirect instead of an image and every link
  preview would have silently broken. Matcher now excludes `.*opengraph-image`
  and `.*twitter-image`.
- **`runtime` re-export in `twitter-image.tsx` was ignored by Next** ("can't
  recognize the exported `runtime` field"), silently falling back to the default
  runtime. It is now declared in the file itself.
- **Missing `metadataBase`** made Next emit relative OG URLs that unfurlers
  reject; all four public pages now set it from `SITE_URL`.
- **Satori clipped the OG background gradient to its box**, drawing a hard
  rectangle across the card. The brass wash now lives inside a
  `borderRadius: 9999` circle.
- **Invite race could provision a stray user.** The invite is now claimed
  *before* the account is created, so the loser of a race on an open link never
  gets an account.

### Security

- Three enforcement layers: edge proxy (routing only, from the JWT snapshot),
  the `/admin` layout (`currentActor()`, database), and `requirePermission()` on
  every admin API (database — the real gate). A stale token can at worst render
  a shell that then refuses every action.
- Anti-escalation: you cannot assign a role, grant a permission, or mint a role
  carrying capabilities you don't hold; only an owner can create a `"*"` role.
  The last active owner cannot be demoted, suspended, or deleted. You cannot
  change your own role/status or delete your own account.
- **Access codes are stored in plaintext by design** — they're meant to be
  shared. Redeeming one never issues a session: it claims a seat, creates the
  account as `invited`, and emails a magic link. A leaked code burns seats
  (revoke it) rather than impersonating anyone.
- Seat claiming is a compare-and-swap on `uses`, so concurrent redemptions can't
  oversell the last seat.
- The waitlist API always answers `{ok:true}` for a valid address (no account
  enumeration) and carries a honeypot field.
- All new tables ship RLS on with **no policies** (default-deny).

### Verified

Templates were copied into a scratch Next 16 / React 19 app built against real
dependencies, then exercised live:

- `next build` — compiled clean, TypeScript clean, **zero warnings**; 36 routes
  emitted, proxy detected.
- Gate — `/` and `/admin/*` → `/login?next=…`; `/login`, `/join`, `/waitlist`,
  `/invite/*` → 200.
- All six OG/Twitter routes → `200 image/png` (login card inspected visually).
- All six `/api/admin/*` routes → **401** unauthenticated.
- `/invite/<bad-token>/opengraph-image` degrades to the generic card when the
  database is unreachable, rather than erroring.

### Known / open

- The **Skills Atlas** (`~/skills-atlas`) indexes skills from SKILL.md
  frontmatter; this skill's `description` and `argument-hint` changed, so run
  `node build.mjs` there to refresh the card and [[Skill Index]].
- **`/intake-portal-login`** documents itself as "built on the login-link-passkey
  auth engine" but carries its own copy of the templates. It was **not** updated
  this session — if it should inherit the admin/RBAC layer, that's a separate
  port.
- The admin UI assumes the Tailwind v4 tokens in `auth-tokens.css`. Projects with
  their own palette must map the token names or restyle the panels.
- No pagination — `listUsers` caps at 500, invites/codes at 200, audit at 200.
  Fine for team-sized tenancies; add paging before a consumer-scale user table.
- `deleteRole` and the last-owner guard are enforced in application code, not by
  database constraints.

---

## 2026-06-07 — Initial skill

- Magic-link email (Resend) + WebAuthn passkeys for Next.js App Router, gated at
  the edge by `src/proxy.ts` with jose sessions.
- Single-use SHA-256-hashed 15-minute links, per-email rate limiting, env
  allow-list.
- One-tap "Add passkey" with no device-name prompt; usernameless sign-in.
- Supabase store (`auth_users`, `auth_magic_links`, `auth_passkeys`) with
  default-deny RLS; service-role key server-side only.
- Branded, table-based Resend email; `/login` screen, account menu, passkey
  prompt; portable CSS tokens.
- `scripts/` for secret generation, Resend domain discovery, and one-shot
  Supabase provisioning.
- Generalized from the Exchange P&L build.

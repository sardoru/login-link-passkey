# Changelog — `/login-link-passkey`

All notable changes to this skill. Newest first. Format follows
[Keep a Changelog](https://keepachangelog.com/); this skill ships templates
rather than a versioned package, so entries are grouped by date.

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

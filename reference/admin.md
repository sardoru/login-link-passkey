# Admin, RBAC, invites, access codes, waitlist

Reference for the access-control half of the skill. The auth core is documented
in `SKILL.md`; provisioning in `setup.md`.

## Permission catalog

Defined in `src/lib/auth/permissions.ts`. Adding a key here makes it appear in
the role grid and the per-user matrix automatically — no migration needed.

| Key | Group | Grants |
| --- | --- | --- |
| `app.access` | App | Use the app at all |
| `admin.access` | Admin | Open `/admin` |
| `audit.read` | Admin | Read the audit log |
| `users.read` | Users | View users |
| `users.write` | Users | Create, rename, re-role, suspend |
| `users.delete` | Users | Delete accounts ⚠ |
| `users.permissions` | Users | Edit per-user overrides ⚠ |
| `roles.read` | Roles | View roles |
| `roles.write` | Roles | Create/edit/delete roles ⚠ |
| `invites.read` / `invites.write` / `invites.revoke` | Invites | See, send, revoke |
| `codes.read` / `codes.write` / `codes.revoke` | Access codes | See, mint, revoke |
| `waitlist.read` / `waitlist.approve` | Waitlist | Review, admit/reject |

⚠ = flagged `sensitive` and shown with a warning triangle in the UI.

### Seeded roles

| Role | Permissions | Notes |
| --- | --- | --- |
| `owner` | `["*"]` | Everything. Bypasses escalation checks. Can't be reduced to zero — the last active owner is protected. |
| `admin` | Everything except `users.delete` and `roles.write` | The day-to-day operator role. |
| `manager` | Read + invites + waitlist | Can grow the team, can't restructure it. |
| `member` | `app.access` | Default for new signups. |

System roles (`is_system = true`) can be edited but not deleted. Custom roles
can be deleted only when no user holds them.

## Effective permissions

```
effective = role.permissions ∪ user.permissions.grant − user.permissions.deny
```

`"*"` in a role expands to the whole catalog before denies are applied, so you
can carve one capability out of an owner-ish role deliberately. Per-user
overrides store **only the deltas** (`{"grant":[…],"deny":[…]}`), so editing a
role still moves everyone who inherits it.

In the UI each cell is tri-state:

- **Inherit** — follow the role (tracks future role edits)
- **Grant** — add for this person only
- **Deny** — remove for this person only, even if the role has it

## Enforcement layers

| Layer | Reads | Enforces |
| --- | --- | --- |
| `src/proxy.ts` (edge) | `perms` claim in the session JWT | Routing only — where to send an unauthenticated or non-admin request |
| `src/app/admin/layout.tsx` | Database via `currentActor()` | Whether the dashboard renders |
| `src/app/api/admin/**` | Database via `requirePermission()` | **The real gate.** Every mutation |

`/api/auth/me` compares the cookie's snapshot to the database and re-signs the
cookie when they diverge, so role changes land on the user's next page load.

### Anti-escalation rules

- `canConferRole` — you can't assign a role holding permissions you lack.
- `canConferPermissions` — you can't grant a permission you don't hold.
- `roles.write` — you can't mint or edit a role beyond your own permissions
  (and only an owner can create a `"*"` role).
- `blocksLastOwner` — the last active owner can't be demoted, suspended, or
  deleted.
- You can't change your own role or status, or delete your own account.

Owners bypass the first three.

## Data model (`0002_admin.sql`)

```
auth_users            + name, role, status, permissions(jsonb), invited_by, invited_at, notes
auth_roles            key, label, description, permissions(jsonb), rank, is_system
auth_invites          email?, name, role, token_hash, expires_at, accepted_at/by, revoked_at, sent_at
auth_access_codes     code, label, role, max_uses, uses, expires_at, revoked_at
auth_access_code_uses code_id, email, user_id, used_at
auth_waitlist         email(unique), name, note, source, status, reviewed_at/by
auth_audit_log        actor_id/email, action, target, meta(jsonb), created_at
```

`status` is one of `active | invited | suspended`. A user created by an admin or
an access code starts as `invited` and flips to `active` on their first real
sign-in (`activateUser`).

All tables: **RLS on, no policies.** The anon key reads nothing.

## Flows

### Add a user (admin)

`POST /api/admin/users {name,email,role,sendEmail}` → creates the account as
`invited`, mints a 3-day invite, sends the branded welcome email through Resend,
and returns the invite URL so the admin can copy it if delivery fails.

### Invite links

`POST /api/admin/invites {email?,name,role,sendEmail}`

- **Bound** (email given): delivery proves the address, so accepting signs them
  straight in.
- **Open** (no email): the recipient types an address and gets a magic link to
  verify it before any session exists.

Single-use, 3 days (`AUTH_INVITE_TTL_DAYS`). The raw token is returned exactly
once — only its SHA-256 hash is stored. Revoke with
`PATCH /api/admin/invites {id, action:"revoke"}`.

The invite is **claimed before the account is created**, so if two people race
an open link, the loser never gets provisioned.

### Access codes

`POST /api/admin/access-codes {label,role,maxUses,expiresInDays}` → a Crockford
base32 code like `ACME-7K2P-QX9M` (no I/L/O/U — unambiguous over the phone).

Seats default to 10; the UI offers 1/5/10/25/50/100 plus a custom field. Codes
are revocable at any time and expose their redemption list.

Redeeming (`POST /api/auth/access-code {code,email,name}`):

1. Validate the code is active (not revoked, expired, or full).
2. Claim a seat with a compare-and-swap on `uses` — concurrent redemptions can't
   oversell the last one.
3. Create the account as `invited` with the code's role.
4. Email a magic link. **No session is issued until that link is opened.**

An email that already has an account doesn't burn a seat — it just gets a
sign-in link.

### Waitlist

Public `POST /api/waitlist {email,name,note,source,company}` — `company` is a
honeypot. Always answers `{ok:true}` for a valid address so the endpoint can't
be used to enumerate accounts. Sends a branded receipt.

Approving (`PATCH /api/admin/waitlist {id,action:"approve",role}`) creates the
account and emails a 3-day invite in one step.

## API summary

| Method + path | Permission |
| --- | --- |
| `GET /api/admin/users` | `users.read` |
| `POST /api/admin/users` | `users.write` + `invites.write` |
| `PATCH /api/admin/users/[id]` | `users.write`, or `users.permissions` when the body carries `permissions` |
| `DELETE /api/admin/users/[id]` | `users.delete` |
| `GET /api/admin/roles` | `roles.read` |
| `PUT` / `DELETE /api/admin/roles` | `roles.write` |
| `GET /api/admin/invites` | `invites.read` |
| `POST /api/admin/invites` | `invites.write` |
| `PATCH /api/admin/invites` | `invites.revoke` |
| `GET /api/admin/access-codes` | `codes.read` |
| `POST /api/admin/access-codes` | `codes.write` |
| `PATCH /api/admin/access-codes` | `codes.revoke` |
| `GET /api/admin/waitlist` | `waitlist.read` |
| `PATCH /api/admin/waitlist` | `waitlist.approve` |
| `GET /api/admin/audit` | `audit.read` |
| `POST /api/auth/invite/accept` | public (token) |
| `POST /api/auth/access-code` | public (code) |
| `POST /api/waitlist` | public |

## OG cards

`src/lib/og/auth-og.tsx` renders all four. Copy lives in each page's
`opengraph-image.tsx`; `twitter-image.tsx` re-uses it.

`/invite/[token]/opengraph-image` personalizes with the invitee's first name when
the token is live, and falls back to a generic card otherwise — a dead or revoked
token must not reveal that it ever existed. It also degrades gracefully if the
database is unreachable.

Satori constraints that bit during development, and will bite again:

- Flexbox only, no grid; every element needs an explicit `display`.
- Gradients clip to their box — the brass wash is a `borderRadius: 9999` circle,
  because a rectangular div showed a hard edge.
- No external fonts unless you fetch and pass the buffer; the templates use
  system serif/sans stacks.
- `runtime` must be declared in the `twitter-image.tsx` file itself, never
  re-exported.

## Bootstrapping the first owner

Set `AUTH_BOOTSTRAP_OWNERS=you@example.com`. On that address's first successful
sign-in (magic link or passkey), `maybeBootstrapOwner` promotes it to `owner`,
sets it `active`, and writes an audit row. Idempotent — remove the variable once
the owner exists. The alternative is the commented `insert` at the bottom of
`0002_admin.sql`.

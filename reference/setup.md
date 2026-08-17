# Setup & provisioning playbook

## Environment variables

| Variable | Where | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | build + runtime | Canonical URL. Magic-link base, email logo, WebAuthn origin. |
| `SUPABASE_URL` | server | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | server | **Secret.** Bypasses RLS. Never ship to the client. |
| `RESEND_API_KEY` | server | From resend.com. |
| `AUTH_EMAIL_FROM` | server | `Name <login@verified-domain>`. |
| `AUTH_JWT_SECRET` | server | `openssl rand -base64 48`. Rotating it logs everyone out. |
| `AUTH_ALLOWED_EMAILS` | server | Comma list. Empty = open (avoid for confidential apps). Known users are always allowed. |
| `AUTH_BOOTSTRAP_OWNERS` | server | Comma list promoted to `owner` on first sign-in. **Set this or nobody can reach `/admin`.** |
| `AUTH_INVITE_TTL_DAYS` | server | Optional. Invite-link lifetime, default `3`. |
| `AUTH_CODE_DEFAULT_USES` | server | Optional. Default seats on a new access code, default `10`. |
| `AUTH_WAITLIST_ENABLED` | server | Optional. `false` 404s `/waitlist` and refuses the API. |
| `AUTH_RP_ID` / `AUTH_RP_NAME` | server | Optional. Default: request host / app name. |

Set the same values in the host. On Vercel:
`printf '%s' "$VALUE" | vercel env add NAME production`.

## Supabase (Management API)

The `provision-supabase.sh` script uses these endpoints with a `sbp_…` token:

- `GET  /v1/organizations` — pick an org id.
- `GET  /v1/projects` — reuse a project by name if it exists.
- `POST /v1/projects` — `{name, organization_id, region, db_pass}` → returns `id` (ref).
- `GET  /v1/projects/{ref}` — poll `status` until `ACTIVE_HEALTHY` (~1–3 min).
- `POST /v1/projects/{ref}/database/query` — `{query: <SQL>}` runs each migration
  (`0001_auth.sql`, `0002_admin.sql`, then `0003_passkeys.sql`, in order).
- `GET  /v1/projects/{ref}/api-keys?reveal=true` — read the `service_role` key.

Manual alternative: open the project's **SQL editor**, run
`templates/supabase/0001_auth.sql`, `0002_admin.sql`, then `0003_passkeys.sql`, then copy Project
URL + the `service_role` key from **Project Settings → API**.

`0002_admin.sql` and `0003_passkeys.sql` are additive and idempotent (`add column if not exists`,
`on conflict do nothing`) — safe to re-run, and safe on a project that already
has 0001 applied with live users.

Verify the tables:
```sql
select table_name from information_schema.tables
where table_schema='public' and table_name like 'auth_%';
-- auth_users, auth_magic_links, auth_passkeys,
-- auth_roles, auth_invites, auth_access_codes, auth_access_code_uses,
-- auth_waitlist, auth_audit_log
```

And that the roles seeded:
```sql
select key, rank, jsonb_array_length(permissions) as perms from auth_roles order by rank;
-- owner(1 = "*"), admin, manager, member
```

## Resend

- A **verified domain** is required to email anyone other than the key owner.
  `find-resend-domain.sh` lists domains + status; pick one marked `verified`.
- No verified domain yet? Add one at resend.com/domains (DNS records), or use
  `onboarding@resend.dev` for local testing (delivers only to the account owner).

## WebAuthn (passkeys)

- `rpID` defaults to the **request host** (so it always matches the current
  origin); set `AUTH_RP_ID` only if you serve auth under a fixed apex domain.
- Passkeys are bound to the domain they're registered on. Register and sign in on
  the **same** canonical host (use the production alias, not a per-deploy URL).
- Sign-in is **usernameless** (empty `allowCredentials` → the browser offers
  discoverable credentials). Registration excludes already-registered credentials.

## Verifying end-to-end

1. `/` (logged out) → 307 → `/login`.
2. `/login` renders; POST `magic/start` with a non-allow-listed email → 403.
3. POST `magic/start` with an allow-listed email → `{ok:true}` + a delivered,
   branded email whose link → `/api/auth/magic/verify?token=…` → sets the session
   cookie → redirects to `/`.
4. Signed in: the account menu's **Add a passkey** completes the WebAuthn
   ceremony (Face ID / Touch ID) with no nickname prompt; afterward
   "Sign in with a passkey" on `/login` works.
5. Signed in as a bootstrap owner, the account menu shows **Admin dashboard** and
   `/admin` loads. Add a user → the welcome email arrives → its link accepts the
   invite → the new user appears in the table with the right role.
6. Public entrances answer 200 while logged out: `/login`, `/join`, `/waitlist`,
   `/invite/<anything>`. `/admin` → 307 → `/login?next=/admin`.
7. OG cards return `image/png`:
   `curl -so /dev/null -w '%{http_code} %{content_type}\n' $SITE/login/opengraph-image`

## Troubleshooting

- **`Missing required environment variable`** at request time → env not set in
  that environment; the build itself never needs them.
- **Email not delivered** → unverified `from` domain, or recipient ≠ key owner in
  test mode. Check Resend → Emails for the event.
- **Passkey "Verification failed"** → origin/rpID mismatch (you registered on a
  different host) or the challenge cookie expired (5-min TTL).
- **Redirect loop on `/login`** → the matcher is catching `/api/auth/*`; keep
  `api` excluded.
- **Link previews show nothing / a broken image** → the matcher is gating the OG
  routes. It must exclude `.*opengraph-image` and `.*twitter-image` (nested paths,
  not just top-level), because unfurlers fetch them with no session. Also confirm
  `metadataBase` is set — otherwise Next emits relative URLs.
- **`/admin` bounces to `/`** → that account lacks `admin.access`. Set
  `AUTH_BOOTSTRAP_OWNERS` and sign in again, or grant the permission from another
  owner account.
- **A role change didn't take effect** → the session snapshot is stale; it
  refreshes on the next `/api/auth/me` (any page load under `<AuthProvider>`).
  Server-side enforcement was never stale.
- **"You can't grant a permission you don't hold"** → anti-escalation. Perform
  the change as an owner.
- **Access code says it's invalid** → check `status` in the admin table: revoked,
  expired, or all seats claimed each return the same generic message on purpose.

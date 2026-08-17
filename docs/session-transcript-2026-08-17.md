# Session transcript — 2026-08-17

Record of the session that added **passkey management** — delete, add more,
and admin-side enrolment — and brought the GitHub mirror up to date.

**Change summary:** [`../CHANGELOG.md`](../CHANGELOG.md) → *2026-08-17*
**Project hub:** `[[Login Link Passkey Hub]]`

## One-paragraph summary

The ask was to let people delete passkeys and add additional ones from the
admin panel. Passkeys had been a single boolean in the UI ("Passkey enabled")
with no list, no delete, and no way for an admin to help someone enrol. The
session shipped: a `PasskeyManager` modal behind the account menu (list with
derived device labels, add another, remove — including the last one, since the
magic link always remains); self-service list/delete routes scoped to the
session's own user id; an admin `PasskeysModal` on every `/admin/users` row
with remove, **add on this device** (in-person / kiosk enrolment, WebAuthn
ceremony bound to the target user), and **email setup link** (single-use magic
link landing on a forced one-tap prompt on the user's own device — the only
honest remote option, because WebAuthn can't register a credential on hardware
you don't hold); a new sensitive `users.passkeys` capability; migration
`0003_passkeys.sql` (device metadata + `created_by`, grants the key to the
seeded `admin` role); and a shared registration helper so the self and admin
routes can't drift. Verified by copying the templates into a fresh Next 16.3 /
React 19.2 app: `tsc` clean, `next build` clean with zero warnings (44 routes),
all nine passkey endpoints answering 401 without a session, and no new lint
findings beyond the four documented baseline hits.

## Decisions worth remembering

- **Two "add" paths, not one.** An admin can only register a passkey on the
  device running the ceremony. If the person is present, hand them the device;
  if not, email a setup link. Anything else would be pretending.
- **On-behalf enrolment is a credential that signs in as someone else.** So it
  is gated by `users.passkeys` + `canConferRole`, refused for suspended
  accounts, tied to a challenge cookie naming both target and admin (the
  self-service verify route rejects any challenge carrying a `by` claim), and
  audited with `created_by` on the row.
- **Deleting the last passkey is allowed.** A stolen-device story must not be
  blocked by "you'd lock yourself out" — the magic link is the fallback.
- **Labels are derived, never typed.** UA + authenticator attachment gives
  "iPhone · Safari" / "Windows Hello" / "Security key · Mac"; the skill's
  "no nickname prompt" promise holds.
- **`?passkey=setup` forces the prompt.** Ignores prior dismissal and existing
  passkeys; strips itself on success; a dismissal in that mode isn't remembered.
- **Adding a permission key does not grant it to seeded roles** (rows predate
  the key). `0003` grants `users.passkeys` to `admin`; project keys still need
  a manual grant in `/admin/roles`.

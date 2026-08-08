# Session transcript — 2026-08-08

Full turn-by-turn record of the session that added the admin dashboard, the
permission matrix, invites, access codes, the waitlist, and custom OG cards.

**Vault note (canonical):**
`~/Documents/Mobile-Brain/02-projects/claude-skills/Login Link Passkey — Build Session 2026-08-08.md`
→ Obsidian: `[[Login Link Passkey — Build Session 2026-08-08]]`

**Project hub:** `[[Login Link Passkey Hub]]`
(`~/Documents/Mobile-Brain/02-projects/claude-skills/Login Link Passkey Hub.md`)

**Change summary:** [`../CHANGELOG.md`](../CHANGELOG.md) → *2026-08-08*

## One-paragraph summary

A single request asked for six additions to the skill: robust user management,
a granular per-user and per-role permission matrix, add-user-with-welcome-email
via the project's Resend key, admin-generated invite links that expire in three
days, custom OG images on the login and invite links, and a waitlist plus
revocable multi-seat access codes. All six shipped as working templates —
50 new files across schema, an RBAC engine, nine API routes, a six-tab admin
dashboard, three public entrances, and a shared OG renderer. Verification was
done by copying the templates into a scratch Next 16 app built against real
dependencies: `next build` clean with zero warnings, then live checks of the
route gate, all six OG endpoints, and 401s on every admin API. That pass caught
three defects that would otherwise have shipped — a proxy matcher that gated
nested OG routes (silently breaking every link preview), a `runtime` field Next
ignores when re-exported, and a Satori gradient clipped into a hard rectangle —
plus one invite race condition found while writing the accept route.

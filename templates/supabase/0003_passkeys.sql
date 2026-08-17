-- login-link-passkey — passkey management (0003)
-- Depends on 0001_auth.sql + 0002_admin.sql. Additive + idempotent; safe on a
-- live project. Adds device metadata to auth_passkeys so users and admins can
-- tell passkeys apart (and delete the right one), records who enrolled each
-- credential, and grants the new `users.passkeys` capability to the seeded
-- admin role.

-- Device metadata --------------------------------------------------------------
-- label: auto-derived at registration ("iPhone · Safari", "Windows Hello",
--        "Security key") — the skill never prompts for a nickname.
alter table auth_passkeys add column if not exists label       text;
-- 'singleDevice' | 'multiDevice' (synced to iCloud Keychain / Google PM / 1Password)
alter table auth_passkeys add column if not exists device_type text;
alter table auth_passkeys add column if not exists backed_up   boolean not null default false;
alter table auth_passkeys add column if not exists aaguid      text;
-- null ⇒ self-enrolled; otherwise the admin who registered it on the user's behalf
alter table auth_passkeys add column if not exists created_by  uuid references auth_users (id) on delete set null;

-- Roles: the seeded `admin` role predates the users.passkeys key, so grant it
-- here. (owner holds "*" and needs nothing.) No-op if already present.
update auth_roles
   set permissions = permissions || '["users.passkeys"]'::jsonb,
       updated_at  = now()
 where key = 'admin'
   and not (permissions ? 'users.passkeys')
   and not (permissions ? '*');

-- Audit actions written by the passkey routes (informational):
--   passkey.deleted        admin removed a user's passkey
--   passkey.enrolled       admin registered a passkey on a user's behalf
--   passkey.setup_sent     admin emailed a passkey-setup link
--   passkey.self_deleted   user removed one of their own passkeys

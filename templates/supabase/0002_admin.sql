-- login-link-passkey — admin, RBAC, invites, access codes, waitlist
-- Depends on 0001_auth.sql. Apply after it.
-- Default-deny everywhere: RLS on, no policies. Only the server's service-role
-- key touches these tables.

-- Users: identity + role + per-user permission overrides ---------------------
alter table auth_users add column if not exists name        text;
alter table auth_users add column if not exists role        text not null default 'member';
alter table auth_users add column if not exists status      text not null default 'active';
-- {"grant":["users.read"],"deny":["invites.write"]} — layered over the role.
alter table auth_users add column if not exists permissions jsonb not null default '{}'::jsonb;
alter table auth_users add column if not exists invited_by  uuid references auth_users (id) on delete set null;
alter table auth_users add column if not exists invited_at  timestamptz;
alter table auth_users add column if not exists notes       text;

do $$ begin
  alter table auth_users add constraint auth_users_status_chk
    check (status in ('active', 'invited', 'suspended'));
exception when duplicate_object then null; end $$;

create index if not exists idx_users_role   on auth_users (role);
create index if not exists idx_users_status on auth_users (status);

-- Roles: the permission matrix rows ------------------------------------------
create table if not exists auth_roles (
  key         text primary key,
  label       text not null,
  description text,
  -- array of permission keys, or ["*"] for everything
  permissions jsonb not null default '[]'::jsonb,
  rank        int  not null default 100,  -- lower = more powerful
  is_system   boolean not null default false, -- system roles can't be deleted
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

insert into auth_roles (key, label, description, permissions, rank, is_system) values
  ('owner',   'Owner',   'Full control, including roles and deletion.', '["*"]'::jsonb, 0, true),
  ('admin',   'Admin',   'Manage users, invites, access codes, waitlist.',
   '["app.access","admin.access","users.read","users.write","users.permissions","users.passkeys","roles.read","invites.read","invites.write","invites.revoke","codes.read","codes.write","codes.revoke","waitlist.read","waitlist.approve","audit.read"]'::jsonb, 10, true),
  ('manager', 'Manager', 'Invite people and clear the waitlist.',
   '["app.access","admin.access","users.read","invites.read","invites.write","codes.read","waitlist.read","waitlist.approve"]'::jsonb, 20, true),
  ('member',  'Member',  'Standard app access.', '["app.access"]'::jsonb, 50, true)
on conflict (key) do nothing;

-- Invites: single-use, 3-day links -------------------------------------------
create table if not exists auth_invites (
  id          uuid primary key default gen_random_uuid(),
  email       text,                       -- null ⇒ open link (email collected on accept)
  name        text,
  role        text not null default 'member',
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth_users (id) on delete set null,
  revoked_at  timestamptz,
  sent_at     timestamptz,                -- set when the welcome email went out
  created_by  uuid references auth_users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_invites_email   on auth_invites (email);
create index if not exists idx_invites_expires on auth_invites (expires_at);

-- Access codes: multi-use signup tokens (e.g. 10 seats), revocable -----------
create table if not exists auth_access_codes (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,        -- shareable, e.g. ACME-7K2P-QX9M
  label      text,
  role       text not null default 'member',
  max_uses   int  not null default 10,
  uses       int  not null default 0,
  expires_at timestamptz,                 -- null ⇒ no expiry
  revoked_at timestamptz,
  created_by uuid references auth_users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_codes_active on auth_access_codes (revoked_at, expires_at);

create table if not exists auth_access_code_uses (
  id      uuid primary key default gen_random_uuid(),
  code_id uuid not null references auth_access_codes (id) on delete cascade,
  email   text not null,
  user_id uuid references auth_users (id) on delete set null,
  used_at timestamptz not null default now()
);
create index if not exists idx_code_uses_code on auth_access_code_uses (code_id);

-- Waitlist -------------------------------------------------------------------
create table if not exists auth_waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  name        text,
  note        text,                        -- "why do you want access"
  source      text,                        -- page / campaign
  status      text not null default 'pending',
  reviewed_at timestamptz,
  reviewed_by uuid references auth_users (id) on delete set null,
  created_at  timestamptz not null default now()
);
do $$ begin
  alter table auth_waitlist add constraint auth_waitlist_status_chk
    check (status in ('pending', 'invited', 'rejected'));
exception when duplicate_object then null; end $$;
create index if not exists idx_waitlist_status on auth_waitlist (status);

-- Audit log: who changed what --------------------------------------------------
create table if not exists auth_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth_users (id) on delete set null,
  actor_email text,
  action      text not null,               -- 'user.role_changed', 'invite.created', …
  target      text,                        -- email / id / code
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_created on auth_audit_log (created_at desc);

-- Default-deny -----------------------------------------------------------------
alter table auth_roles            enable row level security;
alter table auth_invites          enable row level security;
alter table auth_access_codes     enable row level security;
alter table auth_access_code_uses enable row level security;
alter table auth_waitlist         enable row level security;
alter table auth_audit_log        enable row level security;

-- Bootstrap the first owner. Replace the address, or set AUTH_BOOTSTRAP_OWNERS
-- in the environment and let the app promote on first sign-in.
-- insert into auth_users (email, name, role, status)
-- values ('you@example.com', 'Your Name', 'owner', 'active')
-- on conflict (email) do update set role = 'owner', status = 'active';

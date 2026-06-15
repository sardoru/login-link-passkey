-- login-link-passkey — authentication schema (magic links + passkeys)
-- Applied via the Supabase Management API. Service-role key (server-only)
-- bypasses RLS; nothing is reachable with the anon key.

create extension if not exists "pgcrypto";

-- Users -------------------------------------------------------------------
create table if not exists auth_users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

-- Magic links (only the SHA-256 hash of the token is stored) ---------------
create table if not exists auth_magic_links (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_magic_email   on auth_magic_links (email);
create index if not exists idx_magic_expires on auth_magic_links (expires_at);

-- WebAuthn passkeys --------------------------------------------------------
create table if not exists auth_passkeys (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth_users (id) on delete cascade,
  credential_id text not null unique,
  public_key    text not null,
  counter       bigint not null default 0,
  transports    text,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);
create index if not exists idx_passkey_user on auth_passkeys (user_id);

-- Default-deny: RLS on, no policies. Server uses the service-role key.
alter table auth_users       enable row level security;
alter table auth_magic_links enable row level security;
alter table auth_passkeys    enable row level security;

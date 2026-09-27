-- Bpai Dûay Gan — schema. Idempotent: safe to run repeatedly.
-- Column names for events/tags/event_tags match scripts/seed/*.sql exactly; those files load
-- straight in without edits. Field naming for messages/requests follows the team's web contract
-- (apps/web/src/lib/contract.ts), which is the first written statement of CONTRACT.md we have.

-- gen_random_uuid() is core since Postgres 13, so no extension is needed (and the app role,
-- which is not a superuser, could not create one anyway).

-- ── Auth / identity ─────────────────────────────────────────────────────────────────────────
create table if not exists users (
  id              text primary key default gen_random_uuid()::text,
  name            text,
  email           text unique,
  "emailVerified" timestamptz,
  image           text
);

create table if not exists verification_token (
  identifier text not null,
  token      text not null,
  expires    timestamptz not null,
  primary key (identifier, token)
);

-- ── People ──────────────────────────────────────────────────────────────────────────────────
create table if not exists profiles (
  user_id             text primary key references users(id) on delete cascade,
  display_name        text not null,
  avatar_url          text,
  community           text not null check (community in ('local', 'foreigner')),
  interface_language  text not null default 'en' check (interface_language in ('th', 'en')),
  speaks_language     text not null default 'en' check (speaks_language in ('th', 'en')),
  politeness_register text not null default 'neutral' check (politeness_register in ('female', 'male', 'neutral')),
  interests_text      text not null default '',
  onboarding_complete boolean not null default false,
  -- Seeded demo accounts only. Gates the one-click stage login (ALLOW_DEV_LOGIN).
  demo_account        boolean not null default false,
  created_at          timestamptz not null default now()
);

-- The same bio in the other language, written when the bio itself is written (the seed pass, or
-- a save from the Me screen) — never on read, because one Browse page is twenty cards and twenty
-- model calls is not something a page load can pay. Null means "not translated yet", and the card
-- falls back to the original rather than waiting.
alter table profiles add column if not exists interests_text_translated text;

-- Gender (issue #22), added after the table so existing databases pick it up on the next deploy.
-- People set gender; the api writes politeness_register from it on every save (other and
-- undisclosed both mean neutral). Null means unknown. The backfill fills in only rows that have
-- no gender yet, from a register that can only have come from one: male or female. Both
-- statements are safe to re-run.
alter table profiles add column if not exists gender text
  check (gender in ('male', 'female', 'other', 'undisclosed'));
update profiles set gender = politeness_register
  where gender is null and politeness_register in ('male', 'female');

-- ── Tags ────────────────────────────────────────────────────────────────────────────────────
create table if not exists tags (
  id         text primary key,
  label_en   text not null,
  label_th   text not null,
  sort_order int  not null default 100
);

create table if not exists profile_tags (
  user_id   text not null references users(id) on delete cascade,
  tag_id    text not null references tags(id) on delete cascade,
  direction text not null check (direction in ('give', 'learn')),
  primary key (user_id, tag_id, direction)
);

-- ── Events ──────────────────────────────────────────────────────────────────────────────────
create table if not exists events (
  id             uuid primary key default gen_random_uuid(),
  source         text not null check (source in ('seed', 'scrape')),
  external_id    text not null,
  source_url     text,
  title_en       text not null,
  title_th       text not null,
  description_en text,
  description_th text,
  starts_at      timestamptz not null,
  ends_at        timestamptz,
  venue_name     text,
  address        text,
  price_text     text,
  image_url      text,
  created_at     timestamptz not null default now(),
  unique (source, external_id)       -- the upsert key the seed scripts and scraper rely on
);

create index if not exists events_starts_at_idx on events (starts_at);

create table if not exists event_tags (
  event_id uuid not null references events(id) on delete cascade,
  tag_id   text not null references tags(id)  on delete cascade,
  primary key (event_id, tag_id)
);

create table if not exists event_attendance (
  user_id  text not null references users(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  primary key (user_id, event_id)
);

-- ── Matching ────────────────────────────────────────────────────────────────────────────────
create table if not exists match_requests (
  id         uuid primary key default gen_random_uuid(),
  from_user  text not null references users(id) on delete cascade,
  to_user    text not null references users(id) on delete cascade,
  event_id   uuid references events(id) on delete set null,
  note       text,
  status     text not null default 'pending'
               check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  match_id   uuid,
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);

create index if not exists match_requests_to_idx   on match_requests (to_user, status);
create index if not exists match_requests_from_idx on match_requests (from_user, status);

create table if not exists matches (
  id         uuid primary key default gen_random_uuid(),
  a_user     text not null references users(id) on delete cascade,
  b_user     text not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (a_user <> b_user),
  unique (a_user, b_user)
);

-- Field names mirror the web contract's Message exactly.
create table if not exists messages (
  id                 uuid primary key default gen_random_uuid(),
  match_id           uuid not null references matches(id) on delete cascade,
  sender_id          text not null references users(id) on delete cascade,
  client_msg_id      text,
  body_original      text not null,
  lang_original      text not null check (lang_original in ('th', 'en')),
  body_translated    text,
  lang_translated    text check (lang_translated in ('th', 'en')),
  cultural_note      text,
  translation_status text not null default 'pending'
                       check (translation_status in ('pending', 'done', 'failed')),
  read_at            timestamptz,
  created_at         timestamptz not null default now(),
  unique (match_id, client_msg_id)
);

create index if not exists messages_match_idx on messages (match_id, created_at);

-- ── Safety ──────────────────────────────────────────────────────────────────────────────────
create table if not exists blocks (
  blocker_id text not null references users(id) on delete cascade,
  blocked_id text not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create table if not exists reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id text not null references users(id) on delete cascade,
  reported_id text not null references users(id) on delete cascade,
  match_id    uuid,
  reason      text,
  created_at  timestamptz not null default now()
);

-- ── Notifications ───────────────────────────────────────────────────────────────────────────
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null references users(id) on delete cascade,
  kind       text not null check (kind in ('match_request', 'match_accepted', 'message')),
  data       jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on notifications (user_id, created_at desc);

-- Embeddings (RD-4's hybrid) are deferred, not deleted: add a vector column here when a
-- provider is chosen. Ranking works on tags + shared events alone.

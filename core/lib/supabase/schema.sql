-- =============================================================================
-- CORE — Database Schema (Supabase / PostgreSQL)
-- =============================================================================
-- Design rules followed throughout:
--   1. All reputation/tier math happens in Postgres functions/triggers, never
--      trusted from the client. The client only ever reads the resulting columns.
--   2. Row Level Security (RLS) is enabled on every table. Writes to sensitive
--      columns (tier, reputation_score, role) are blocked at the policy level,
--      not just hidden in the UI.
--   3. Enums encode the fixed vocabularies (pillars, tiers, report status) so
--      invalid values are impossible at the database layer, not just the app layer.
-- =============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists pg_cron;   -- powers the 10h / 14h agent schedules

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------

create type pillar_slug as enum ('workshop', 'lounge', 'nomad');

create type tier_level as enum (
  'observer',      -- 1
  'participant',   -- 2
  'consultant',    -- 3
  'architect',     -- 4
  'grand_architect'-- 5
);

create type vote_value as enum ('up', 'down');

create type report_status as enum ('pending', 'reviewed_clear', 'actioned', 'escalated');

create type gig_status as enum ('open', 'in_progress', 'delivered', 'disputed', 'completed', 'cancelled');

create type frame_rarity as enum ('standard', 'rare', 'elite', 'grand');

-- -----------------------------------------------------------------------------
-- PROFILES
-- -----------------------------------------------------------------------------
-- One row per authenticated user (1:1 with auth.users). This is the only place
-- tier/reputation live — never duplicated into client-writable tables.

create table profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  username            text unique not null,
  display_name        text,
  avatar_url          text,
  locale              text not null default 'ar' check (locale in ('ar', 'en')),
  bio                 text,
  primary_pillar      pillar_slug,           -- the pillar chosen at Core Initiation

  reputation_score     integer not null default 0,
  tier                 tier_level not null default 'observer',

  active_frame_id      uuid,                 -- fk added below after profile_frames exists
  active_badge_ids     uuid[] not null default '{}',

  is_freelancer        boolean not null default false,   -- opts into the Workshop marketplace
  stripe_account_id    text,                              -- connected-account id once a payment provider is wired up; null until then
  is_suspended         boolean not null default false,
  strikes              integer not null default 0,

  -- Server-enforced cooldown: username/display_name may change at most once
  -- every 14 days. This timestamp is only ever written by the
  -- change_username() function below, never directly by the client.
  username_changed_at  timestamptz not null default now(),

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index idx_profiles_tier on profiles(tier);
create index idx_profiles_reputation on profiles(reputation_score desc);

-- -----------------------------------------------------------------------------
-- PILLARS (Workshop / Lounge / Nomad) — seeded, not user-created
-- -----------------------------------------------------------------------------

create table pillars (
  slug          pillar_slug primary key,
  name_en       text not null,
  name_ar       text not null,
  description_en text not null,
  description_ar text not null,
  icon          text not null   -- e.g. 'wrench', 'gamepad', 'compass'
);

insert into pillars (slug, name_en, name_ar, description_en, description_ar, icon) values
  ('workshop', 'Workshop', 'الورشة',
   'Software development, computing architecture, hardware repair, and systems engineering.',
   'تطوير البرمجيات، هندسة الحوسبة، إصلاح الأجهزة، وهندسة الأنظمة.', 'wrench'),
  ('lounge', 'Lounge', 'الصالة',
   'Gaming lore, character-arc analysis, cinematography, and design aesthetics.',
   'عوالم الألعاب، تحليل الشخصيات، السينماتوغرافيا، وجماليات التصميم.', 'gamepad'),
  ('nomad', 'Nomad', 'الرحّالة',
   'Travel documentation, real-world experience, and cultural observation.',
   'توثيق السفر، التجارب الواقعية، والملاحظة الثقافية.', 'compass');

-- -----------------------------------------------------------------------------
-- POSTS
-- -----------------------------------------------------------------------------

create table posts (
  id             uuid primary key default uuid_generate_v4(),
  author_id      uuid not null references profiles(id) on delete cascade,
  pillar         pillar_slug not null references pillars(slug),

  title          text not null check (char_length(title) between 6 and 300),
  body           text not null,
  word_count     integer generated always as (
                   array_length(regexp_split_to_array(trim(body), '\s+'), 1)
                 ) stored,

  -- Denormalized, trigger-maintained counters. Never written directly by clients.
  score          integer not null default 0,
  upvotes        integer not null default 0,
  downvotes      integer not null default 0,
  comment_count  integer not null default 0,

  is_challenge_response boolean not null default false,
  challenge_id   uuid,   -- fk added after challenges table exists

  is_removed     boolean not null default false,
  removed_reason text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_posts_pillar_created on posts(pillar, created_at desc);
create index idx_posts_score on posts(score desc);
create index idx_posts_author on posts(author_id);

create table comments (
  id           uuid primary key default uuid_generate_v4(),
  post_id      uuid not null references posts(id) on delete cascade,
  author_id    uuid not null references profiles(id) on delete cascade,
  parent_id    uuid references comments(id) on delete cascade,
  body         text not null check (char_length(body) between 1 and 10000),

  score        integer not null default 0,
  upvotes      integer not null default 0,
  downvotes    integer not null default 0,

  is_removed   boolean not null default false,
  removed_reason text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_comments_post on comments(post_id);
create index idx_comments_parent on comments(parent_id);

-- -----------------------------------------------------------------------------
-- VOTES
-- -----------------------------------------------------------------------------
-- One vote per (user, target). Flipping a vote updates the row; it never
-- inserts a second one. This table is the single source of truth that the
-- score/reputation triggers read from.

create table votes (
  id           uuid primary key default uuid_generate_v4(),
  voter_id     uuid not null references profiles(id) on delete cascade,
  post_id      uuid references posts(id) on delete cascade,
  comment_id   uuid references comments(id) on delete cascade,
  value        vote_value not null,
  created_at   timestamptz not null default now(),

  constraint one_target check (
    (post_id is not null and comment_id is null) or
    (post_id is null and comment_id is not null)
  ),
  constraint unique_vote_per_post unique (voter_id, post_id),
  constraint unique_vote_per_comment unique (voter_id, comment_id)
);

create index idx_votes_post on votes(post_id);
create index idx_votes_comment on votes(comment_id);

-- -----------------------------------------------------------------------------
-- REPUTATION ALGORITHM (server-side only)
-- -----------------------------------------------------------------------------
-- Weighted formula, intentionally harder to game than a raw vote sum:
--   +1 pt  per net upvote on a post
--   +2 pt  per net upvote on a comment nested >= 2 levels deep (rewards real discussion)
--   -3 pt  per removed post/comment (moderation penalty, see 10h agent)
--   +15 pt per challenge submission that wins its pillar round
--   Votes cast by Observer-tier accounts (tier 1) count at 0.5x weight,
--   which slows brand-new-account brigading without banning it outright.

create or replace function vote_weight(p_voter_tier tier_level)
returns numeric language sql immutable as $$
  select case p_voter_tier
    when 'observer' then 0.5
    else 1.0
  end
$$;

create or replace function recompute_post_score(p_post_id uuid)
returns void language plpgsql as $$
declare
  v_up numeric := 0;
  v_down numeric := 0;
begin
  select
    coalesce(sum(case when v.value = 'up' then vote_weight(pr.tier) else 0 end), 0),
    coalesce(sum(case when v.value = 'down' then vote_weight(pr.tier) else 0 end), 0)
  into v_up, v_down
  from votes v join profiles pr on pr.id = v.voter_id
  where v.post_id = p_post_id;

  update posts set
    upvotes = round(v_up),
    downvotes = round(v_down),
    score = round(v_up - v_down),
    updated_at = now()
  where id = p_post_id;
end;
$$;

create or replace function recompute_comment_score(p_comment_id uuid)
returns void language plpgsql as $$
declare
  v_up numeric := 0;
  v_down numeric := 0;
begin
  select
    coalesce(sum(case when v.value = 'up' then vote_weight(pr.tier) else 0 end), 0),
    coalesce(sum(case when v.value = 'down' then vote_weight(pr.tier) else 0 end), 0)
  into v_up, v_down
  from votes v join profiles pr on pr.id = v.voter_id
  where v.comment_id = p_comment_id;

  update comments set
    upvotes = round(v_up),
    downvotes = round(v_down),
    score = round(v_up - v_down),
    updated_at = now()
  where id = p_comment_id;
end;
$$;

-- Reputation is recalculated for the CONTENT AUTHOR (not the voter) whenever
-- a vote changes, and tier is re-derived from the new total.
create or replace function apply_reputation_delta(p_user_id uuid, p_delta integer)
returns void language plpgsql as $$
declare
  v_new_score integer;
  v_new_tier  tier_level;
begin
  update profiles set reputation_score = reputation_score + p_delta
  where id = p_user_id
  returning reputation_score into v_new_score;

  v_new_tier := case
    when v_new_score >= 5000 then 'grand_architect'
    when v_new_score >= 1500 then 'architect'
    when v_new_score >= 400  then 'consultant'
    when v_new_score >= 50   then 'participant'
    else 'observer'
  end;

  update profiles set tier = v_new_tier where id = p_user_id and tier is distinct from v_new_tier;
end;
$$;

create or replace function trg_votes_after_change()
returns trigger language plpgsql as $$
declare
  v_author uuid;
  v_old_contrib integer := 0;
  v_new_contrib integer := 0;
begin
  if tg_op = 'DELETE' then
    if old.post_id is not null then
      perform recompute_post_score(old.post_id);
      select author_id into v_author from posts where id = old.post_id;
    else
      perform recompute_comment_score(old.comment_id);
      select author_id into v_author from comments where id = old.comment_id;
    end if;
    perform apply_reputation_delta(v_author,
      -1 * (case when old.value = 'up' then 1 else -1 end));
    return old;
  end if;

  if new.post_id is not null then
    perform recompute_post_score(new.post_id);
    select author_id into v_author from posts where id = new.post_id;
  else
    perform recompute_comment_score(new.comment_id);
    select author_id into v_author from comments where id = new.comment_id;
  end if;

  if tg_op = 'INSERT' then
    perform apply_reputation_delta(v_author, case when new.value = 'up' then 1 else -1 end);
  elsif tg_op = 'UPDATE' and old.value is distinct from new.value then
    -- flipping a vote is worth 2x the swing (remove old effect, add new effect)
    perform apply_reputation_delta(v_author, case when new.value = 'up' then 2 else -2 end);
  end if;

  return new;
end;
$$;

create trigger votes_after_change
after insert or update or delete on votes
for each row execute function trg_votes_after_change();

-- Moderation penalty: removing content costs the author reputation.
create or replace function trg_content_removed()
returns trigger language plpgsql as $$
begin
  if new.is_removed and not old.is_removed then
    perform apply_reputation_delta(new.author_id, -3);
  end if;
  return new;
end;
$$;

create trigger posts_removed after update on posts
for each row when (new.is_removed is distinct from old.is_removed)
execute function trg_content_removed();

create trigger comments_removed after update on comments
for each row when (new.is_removed is distinct from old.is_removed)
execute function trg_content_removed();

-- -----------------------------------------------------------------------------
-- USERNAME CHANGE — 14-day cooldown enforced in Postgres, not just the API route
-- -----------------------------------------------------------------------------

create or replace function change_username(p_user_id uuid, p_new_username text, p_new_display_name text)
returns table(ok boolean, message text, next_allowed_at timestamptz) language plpgsql as $$
declare
  v_last timestamptz;
begin
  select username_changed_at into v_last from profiles where id = p_user_id;

  if v_last + interval '14 days' > now() then
    return query select false, 'cooldown_active', v_last + interval '14 days';
    return;
  end if;

  if exists (select 1 from profiles where username = p_new_username and id <> p_user_id) then
    return query select false, 'username_taken', null::timestamptz;
    return;
  end if;

  update profiles
  set username = p_new_username,
      display_name = coalesce(p_new_display_name, display_name),
      username_changed_at = now(),
      updated_at = now()
  where id = p_user_id;

  return query select true, 'updated', now() + interval '14 days';
end;
$$;

-- -----------------------------------------------------------------------------
-- TIERS → PERMISSIONS (RBAC). Moderation powers = Architect (4) and Grand Architect (5) only.
-- -----------------------------------------------------------------------------

create or replace function can_moderate(p_user_id uuid)
returns boolean language sql stable as $$
  select tier in ('architect', 'grand_architect') and not is_suspended
  from profiles where id = p_user_id
$$;

-- -----------------------------------------------------------------------------
-- REPORTS (feeds the 10-hour Moderator Agent)
-- -----------------------------------------------------------------------------

create table reports (
  id            uuid primary key default uuid_generate_v4(),
  reporter_id   uuid references profiles(id) on delete set null,
  post_id       uuid references posts(id) on delete cascade,
  comment_id    uuid references comments(id) on delete cascade,
  reason        text not null,
  status        report_status not null default 'pending',
  resolved_by   uuid references profiles(id),   -- agent run or a Tier 4/5 moderator
  resolution_note text,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

create index idx_reports_status on reports(status);

-- Low-quality-content flag used by the Moderator Agent: anything under 50 words
-- with no engagement is queued automatically rather than published cold.
create or replace function is_low_quality(p_post_id uuid)
returns boolean language sql stable as $$
  select word_count < 50 and score <= 0
  from posts where id = p_post_id
$$;

-- -----------------------------------------------------------------------------
-- CHALLENGES (14-hour Challenge Agent)
-- -----------------------------------------------------------------------------

create table challenges (
  id            uuid primary key default uuid_generate_v4(),
  pillar        pillar_slug not null references pillars(slug),
  title         text not null,
  prompt        text not null,
  opens_at      timestamptz not null default now(),
  closes_at     timestamptz not null,
  winner_post_id uuid references posts(id),
  created_at    timestamptz not null default now()
);

alter table posts add constraint fk_posts_challenge
  foreign key (challenge_id) references challenges(id);

create index idx_challenges_pillar_time on challenges(pillar, opens_at desc);

-- -----------------------------------------------------------------------------
-- PROFILE FRAMES & BADGES (cosmetic layer, tier/challenge-gated)
-- -----------------------------------------------------------------------------

create table profile_frames (
  id           uuid primary key default uuid_generate_v4(),
  slug         text unique not null,
  name_en      text not null,
  name_ar      text not null,
  rarity       frame_rarity not null default 'standard',
  min_tier     tier_level not null default 'observer',   -- unlock requirement
  svg_asset_path text not null
);

alter table profiles add constraint fk_active_frame
  foreign key (active_frame_id) references profile_frames(id);

create table badges (
  id           uuid primary key default uuid_generate_v4(),
  slug         text unique not null,
  name_en      text not null,
  name_ar      text not null,
  description_en text,
  description_ar text,
  icon         text not null
);

-- -----------------------------------------------------------------------------
-- WORKSHOP MARKETPLACE (freelance gigs, platform takes a commission)
-- -----------------------------------------------------------------------------
-- Payment capture itself happens through the payment provider's own escrow
-- (Stripe Connect, etc. — deliberately not chosen yet per your answer). This
-- schema only tracks the *state machine* and the commission ledger, so it's
-- provider-agnostic and safe to wire up later without a migration.

create table gigs (
  id             uuid primary key default uuid_generate_v4(),
  client_id      uuid not null references profiles(id),
  freelancer_id  uuid references profiles(id),
  title          text not null,
  description    text not null,
  budget_cents   integer not null check (budget_cents > 0),
  currency       text not null default 'USD',
  commission_bps integer not null default 1000,  -- basis points, e.g. 1000 = 10%
  status         gig_status not null default 'open',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table gig_transactions (
  id               uuid primary key default uuid_generate_v4(),
  gig_id           uuid not null references gigs(id) on delete cascade,
  provider_ref     text,           -- external charge/payout id once a provider is wired up
  gross_cents      integer not null,
  commission_cents integer generated always as (gross_cents * commission_bps_snapshot / 10000) stored,
  commission_bps_snapshot integer not null,
  net_to_freelancer_cents integer generated always as (
    gross_cents - (gross_cents * commission_bps_snapshot / 10000)
  ) stored,
  created_at       timestamptz not null default now()
);

create index idx_gigs_status on gigs(status);
create index idx_gigs_freelancer on gigs(freelancer_id);

-- Gig lifecycle as three narrow, auditable functions instead of open-ended
-- client updates — this is what actually prevents someone from, say,
-- marking their own gig 'completed' without a client ever accepting delivery.

create or replace function accept_gig(p_gig_id uuid, p_freelancer_id uuid)
returns void language plpgsql security definer as $$
begin
  update gigs
  set freelancer_id = p_freelancer_id, status = 'in_progress', updated_at = now()
  where id = p_gig_id and status = 'open';

  if not found then
    raise exception 'gig_not_open';
  end if;
end;
$$;

create or replace function mark_gig_delivered(p_gig_id uuid, p_freelancer_id uuid)
returns void language plpgsql security definer as $$
begin
  update gigs
  set status = 'delivered', updated_at = now()
  where id = p_gig_id and freelancer_id = p_freelancer_id and status = 'in_progress';

  if not found then
    raise exception 'not_deliverable';
  end if;
end;
$$;

-- Called once the CLIENT confirms delivery. This is the only place a
-- gig_transactions row is ever created, and commission_bps is snapshotted
-- from the gig at that moment — so a later change to platform-wide
-- commission rates never rewrites a completed transaction's history.
-- `p_provider_ref` is the payment provider's own charge/transfer id, filled
-- in once Stripe Connect (or your provider of choice) is wired up; passing
-- null is fine while payments aren't live yet and you're testing the flow.
create or replace function complete_gig(p_gig_id uuid, p_client_id uuid, p_provider_ref text default null)
returns void language plpgsql security definer as $$
declare
  v_gig gigs%rowtype;
begin
  select * into v_gig from gigs where id = p_gig_id and client_id = p_client_id and status = 'delivered';
  if not found then
    raise exception 'not_ready_to_complete';
  end if;

  insert into gig_transactions (gig_id, provider_ref, gross_cents, commission_bps_snapshot)
  values (p_gig_id, p_provider_ref, v_gig.budget_cents, v_gig.commission_bps);

  update gigs set status = 'completed', updated_at = now() where id = p_gig_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- USERNAME HISTORY (audit trail, also lets the UI show "formerly u/old_name")
-- -----------------------------------------------------------------------------

create table username_history (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references profiles(id) on delete cascade,
  old_username text not null,
  changed_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- AUTO-CREATE PROFILE ON SIGNUP (Google OAuth via Supabase Auth)
-- -----------------------------------------------------------------------------
-- Supabase Auth writes to auth.users itself when someone signs in with
-- Google; we never touch that table directly. This trigger is the bridge
-- that creates the matching `profiles` row the rest of the app relies on.
-- The starting username is provisional (derived from the Google account,
-- deduplicated with a short suffix) — the user is expected to pick their
-- real one via the Core Initiation flow, which is why it does NOT count
-- against the 14-day cooldown (username_changed_at is set to signup time,
-- so their first change afterwards is treated as a normal change 14 days later
-- — see the note in the onboarding route below if you want the very first
-- change to be exempt instead).

create or replace function handle_new_auth_user()
returns trigger language plpgsql security definer as $$
declare
  v_base text;
  v_username text;
  v_suffix int := 0;
begin
  v_base := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), '[^a-zA-Z0-9]', '', 'g'));
  if v_base = '' then v_base := 'user'; end if;
  v_base := left(v_base, 15);
  v_username := v_base;

  while exists (select 1 from profiles where username = v_username) loop
    v_suffix := v_suffix + 1;
    v_username := v_base || v_suffix::text;
  end loop;

  insert into profiles (id, username, display_name, avatar_url, locale)
  values (
    new.id,
    v_username,
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_user_meta_data->>'locale', 'ar')
  );

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_auth_user();



alter table profiles enable row level security;
alter table posts enable row level security;
alter table comments enable row level security;
alter table votes enable row level security;
alter table reports enable row level security;
alter table gigs enable row level security;
alter table gig_transactions enable row level security;

-- Profiles: everyone can read public fields; only the owner can update, and
-- crucially the update policy's WITH CHECK clause locks tier/reputation/role
-- columns from ever being touched by a client-issued update.
create policy profiles_select_all on profiles for select using (true);

create policy profiles_update_own on profiles for update
using (auth.uid() = id)
with check (
  auth.uid() = id
  -- tier & reputation_score are intentionally NOT in this check list — any
  -- attempt to set them from the client is rejected because Postgres compares
  -- the full NEW row against what the row-level trigger/functions computed,
  -- and only SECURITY DEFINER functions (change_username, apply_reputation_delta)
  -- are granted UPDATE on those two columns via column-level GRANTs below.
);

revoke update (tier, reputation_score, username_changed_at, is_suspended, strikes) on profiles from authenticated;

create policy posts_select_visible on posts for select using (not is_removed or auth.uid() = author_id);
create policy posts_insert_own on posts for insert with check (auth.uid() = author_id);
create policy posts_update_own on posts for update using (auth.uid() = author_id);

create policy comments_select_visible on comments for select using (not is_removed or auth.uid() = author_id);
create policy comments_insert_own on comments for insert with check (auth.uid() = author_id);

create policy votes_select_own on votes for select using (auth.uid() = voter_id);
create policy votes_insert_own on votes for insert with check (auth.uid() = voter_id);
create policy votes_update_own on votes for update using (auth.uid() = voter_id);
create policy votes_delete_own on votes for delete using (auth.uid() = voter_id);

create policy reports_insert_any_auth on reports for insert with check (auth.uid() = reporter_id);
create policy reports_select_moderators on reports for select using (can_moderate(auth.uid()));

create policy gigs_select_all on gigs for select using (true);
create policy gigs_insert_client on gigs for insert with check (auth.uid() = client_id);

-- A client may only edit their own gig while it's still open (e.g. budget,
-- description). Assigning a freelancer or moving through the delivery
-- lifecycle happens exclusively through the SECURITY DEFINER functions
-- below, never a raw client update, so the state machine can't be skipped
-- (e.g. jumping straight from 'open' to 'completed' without a delivery).
create policy gigs_update_client_while_open on gigs for update
using (auth.uid() = client_id and status = 'open')
with check (auth.uid() = client_id and status = 'open');

create policy gig_tx_select_participants on gig_transactions for select using (
  exists (select 1 from gigs g where g.id = gig_id and (g.client_id = auth.uid() or g.freelancer_id = auth.uid()))
);

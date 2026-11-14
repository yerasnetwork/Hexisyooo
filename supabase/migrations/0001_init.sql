-- Hexis schema. No auth tables: visitor_id is a client-generated UUID
-- (localStorage), not a Supabase auth user. There's no account system to
-- scope RLS policies to, so access control for this hackathon demo relies
-- on unguessable UUIDs/room codes rather than row-level ownership checks.
-- All access happens server-side (API routes), using the publishable key.

create extension if not exists pgcrypto;

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null,
  title text not null,
  duration_weeks int not null check (duration_weeks > 0),
  sessions_per_week int not null check (sessions_per_week > 0),
  minutes_per_session int not null check (minutes_per_session > 0),
  deposit_amount numeric not null check (deposit_amount >= 0),
  carried_over_locked numeric not null default 0,
  cycle_pool numeric not null,
  weekly_unlock_amount numeric not null,
  claimable_balance numeric not null default 0,
  locked_balance numeric not null,
  current_week int not null default 1,
  status text not null default 'active' check (status in ('active', 'completed')),
  room_code text,
  nickname text,
  created_at timestamptz not null default now()
);

create index if not exists goals_visitor_id_idx on goals (visitor_id);
create index if not exists goals_room_code_idx on goals (room_code);

create table if not exists weeks (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  week_number int not null,
  title text not null,
  target_minutes int not null,
  target_sessions int not null,
  checkpoint text,
  verified_minutes numeric not null default 0,
  verified_sessions int not null default 0,
  settled boolean not null default false,
  unlocked_amount numeric not null default 0,
  unique (goal_id, week_number)
);

create index if not exists weeks_goal_id_idx on weeks (goal_id);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  week_id uuid not null references weeks(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  verified_minutes numeric not null default 0
);

create index if not exists sessions_goal_id_idx on sessions (goal_id);

create table if not exists leaderboard_entries (
  id uuid primary key default gen_random_uuid(),
  room_code text not null,
  visitor_id uuid not null,
  nickname text not null,
  verified_minutes_week numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (room_code, visitor_id)
);

create index if not exists leaderboard_room_code_idx on leaderboard_entries (room_code);

alter table goals enable row level security;
alter table weeks enable row level security;
alter table sessions enable row level security;
alter table leaderboard_entries enable row level security;

create policy "anon full access" on goals for all to anon using (true) with check (true);
create policy "anon full access" on weeks for all to anon using (true) with check (true);
create policy "anon full access" on sessions for all to anon using (true) with check (true);
create policy "anon full access" on leaderboard_entries for all to anon using (true) with check (true);

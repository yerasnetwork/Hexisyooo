-- Family mode: a parent funds a goal, a child joins via invite code (same
-- no-account pattern as the friends leaderboard) and does the sessions.
-- Kept as a separate code path from room_code/leaderboard_entries, which
-- stay untouched for the solo-adult flow.

alter table goals add column if not exists is_family boolean not null default false;
alter table goals add column if not exists invite_code text unique;
alter table goals add column if not exists child_nickname text;
alter table goals add column if not exists child_visitor_id uuid;

create index if not exists goals_invite_code_idx on goals (invite_code);

-- One short clip per session, recorded client-side and uploaded here.
alter table sessions add column if not exists clip_path text;

insert into storage.buckets (id, name, public)
values ('session-clips', 'session-clips', true)
on conflict (id) do nothing;

create policy "anon insert session clips" on storage.objects
  for insert to anon with check (bucket_id = 'session-clips');

create policy "anon read session clips" on storage.objects
  for select to anon using (bucket_id = 'session-clips');

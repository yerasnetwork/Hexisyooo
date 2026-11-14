-- Real content inside sessions: either AI-generated weekly content (skill
-- goals) or user-uploaded book chunks (one per planned session).

alter table goals add column if not exists content_source text not null default 'skill'
  check (content_source in ('skill', 'book'));

alter table weeks add column if not exists content text not null default '';

create table if not exists book_chunks (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  unique (goal_id, chunk_index)
);

create index if not exists book_chunks_goal_id_idx on book_chunks (goal_id);

alter table book_chunks enable row level security;
create policy "anon full access" on book_chunks for all to anon using (true) with check (true);

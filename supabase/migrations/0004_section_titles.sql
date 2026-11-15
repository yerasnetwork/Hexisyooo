-- Reading sections now carry their own content-derived title (book chunks),
-- decoupled from the weekly pool/unlock structure, which is unchanged.
alter table book_chunks add column if not exists title text not null default '';

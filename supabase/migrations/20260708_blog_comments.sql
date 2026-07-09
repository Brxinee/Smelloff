-- ============================================================================
-- Blog comments — open commenting on /blog/* posts.
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--
-- Model:  one row per public comment. Name + comment body are public and
--         rendered on the post. The commenter's EMAIL is NOT stored here — it
--         is captured separately into the existing `waitlist` table + Google
--         Sheet by the client, so this table stays free of personal contact
--         data. RLS below is intentionally strict: read approved rows, anon
--         insert with length checks, and NO update/delete for anon.
-- ============================================================================

create table if not exists public.blog_comments (
  id          uuid        primary key default gen_random_uuid(),
  post_slug   text        not null,
  author_name text        not null check (char_length(author_name) between 1 and 60),
  body        text        not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now(),
  approved    boolean     not null default true
);

-- Fast "newest comments for this post" lookups.
create index if not exists blog_comments_post_created_idx
  on public.blog_comments (post_slug, created_at desc);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.blog_comments enable row level security;

-- Drop first so this script is safe to re-run.
drop policy if exists "blog_comments_select_approved" on public.blog_comments;
drop policy if exists "blog_comments_insert_anon"     on public.blog_comments;

-- SELECT: anyone may read, but only approved comments.
create policy "blog_comments_select_approved"
  on public.blog_comments
  for select
  using (approved = true);

-- INSERT: anon may post, but the row must satisfy the length limits. The column
-- CHECK constraints already enforce these; repeating them in the policy means a
-- violating insert is rejected by RLS (as a policy failure) even before the
-- constraint fires, and documents the contract at the policy level.
create policy "blog_comments_insert_anon"
  on public.blog_comments
  for insert
  to anon
  with check (
    char_length(author_name) between 1 and 60
    and char_length(body) between 1 and 2000
    and char_length(post_slug) between 1 and 200
  );

-- NOTE: No UPDATE or DELETE policies are created. With RLS enabled and no such
-- policy, anon users cannot edit or delete any comment. Moderate/delete from
-- the Supabase dashboard or with the service_role key on the server only.

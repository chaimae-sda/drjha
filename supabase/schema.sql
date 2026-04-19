create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  username text not null,
  avatar text default '👧',
  avatar_image text default '',
  level integer not null default 1,
  level_name text not null default 'Decouverte',
  xp integer not null default 0,
  books_read integer not null default 0,
  badges jsonb not null default '[]'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.texts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  original_text text not null,
  darija_text text not null,
  language text not null default 'fr',
  source text not null default 'upload',
  file_name text default '',
  mime_type text default '',
  generated_questions jsonb not null default '[]'::jsonb,
  read_count integer not null default 0,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists texts_set_updated_at on public.texts;
create trigger texts_set_updated_at
before update on public.texts
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.texts enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "texts_select_own" on public.texts;
create policy "texts_select_own"
on public.texts
for select
using (auth.uid() = owner_id);

drop policy if exists "texts_insert_own" on public.texts;
create policy "texts_insert_own"
on public.texts
for insert
with check (auth.uid() = owner_id);

drop policy if exists "texts_update_own" on public.texts;
create policy "texts_update_own"
on public.texts
for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "texts_delete_own" on public.texts;
create policy "texts_delete_own"
on public.texts
for delete
using (auth.uid() = owner_id);

-- Migration: create album and preview generation schema
-- Apply manually in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    email text not null unique,
    full_name text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.albums (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    name text not null,
    description text not null default '',
    cover_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.album_photos (
    id uuid primary key default gen_random_uuid(),
    album_id uuid not null references public.albums (id) on delete cascade,
    image_url text not null,
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
);

create table if not exists public.preview_generations (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    album_id uuid references public.albums (id) on delete set null,
    title text not null,
    prompt text not null,
    image_url text,
    status text not null default 'draft',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_albums_user_id
    on public.albums (user_id);

create index if not exists idx_album_photos_album_id
    on public.album_photos (album_id);

create index if not exists idx_preview_generations_user_id
    on public.preview_generations (user_id);

create index if not exists idx_preview_generations_album_id
    on public.preview_generations (album_id);

alter table public.profiles enable row level security;
alter table public.albums enable row level security;
alter table public.album_photos enable row level security;
alter table public.preview_generations enable row level security;

create policy if not exists "Profiles are viewable by owner"
    on public.profiles
    for select
    using (auth.uid() = id);

create policy if not exists "Users can insert own profile"
    on public.profiles
    for insert
    with check (auth.uid() = id);

create policy if not exists "Users can update own profile"
    on public.profiles
    for update
    using (auth.uid() = id)
    with check (auth.uid() = id);

create policy if not exists "Users can view own albums"
    on public.albums
    for select
    using (auth.uid() = user_id);

create policy if not exists "Users can insert own albums"
    on public.albums
    for insert
    with check (auth.uid() = user_id);

create policy if not exists "Users can update own albums"
    on public.albums
    for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy if not exists "Users can delete own albums"
    on public.albums
    for delete
    using (auth.uid() = user_id);

create policy if not exists "Users can view own album photos"
    on public.album_photos
    for select
    using (exists (
        select 1
        from public.albums a
        where a.id = album_photos.album_id
          and a.user_id = auth.uid()
    ));

create policy if not exists "Users can insert own album photos"
    on public.album_photos
    for insert
    with check (exists (
        select 1
        from public.albums a
        where a.id = album_photos.album_id
          and a.user_id = auth.uid()
    ));

create policy if not exists "Users can delete own album photos"
    on public.album_photos
    for delete
    using (exists (
        select 1
        from public.albums a
        where a.id = album_photos.album_id
          and a.user_id = auth.uid()
    ));

create policy if not exists "Users can view own preview generations"
    on public.preview_generations
    for select
    using (auth.uid() = user_id);

create policy if not exists "Users can insert own preview generations"
    on public.preview_generations
    for insert
    with check (auth.uid() = user_id);

create policy if not exists "Users can update own preview generations"
    on public.preview_generations
    for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy if not exists "Users can delete own preview generations"
    on public.preview_generations
    for delete
    using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger set_updated_at_profiles
    before update on public.profiles
    for each row
    execute function public.set_updated_at();

create trigger set_updated_at_albums
    before update on public.albums
    for each row
    execute function public.set_updated_at();

create trigger set_updated_at_preview_generations
    before update on public.preview_generations
    for each row
    execute function public.set_updated_at();

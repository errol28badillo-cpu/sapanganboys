-- Sapangan Boys Supabase setup
-- 1. Create admin@gmail.com in Authentication > Users first.
--    Set the password there and enable Auto Confirm User.
-- 2. Run this entire script in Supabase SQL Editor.
-- 3. If the user was created after this script, rerun the final admin_users INSERT.

create extension if not exists "uuid-ossp";

create table if not exists public.categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key default uuid_generate_v4(),
  display_name text not null,
  short_description text not null,
  bio text not null default '',
  profile_image_url text not null default '',
  hobbies text[] not null default '{}',
  interests text[] not null default '{}',
  category_id uuid references public.categories(id) on delete set null,
  social_links jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  consent_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.site_content (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.site_content (key, value) values
  ('boys_intro', 'Browse the faces, interests, and stories of our community.'),
  ('about_heading', 'Small place. Big character.'),
  ('about_body', 'Sapangan Boys is a community profile website created to showcase the personalities, interests, hobbies, and activities of consenting members of Sapangan, San Juan, Batangas.'),
  ('contact_email', 'hello@sapanganboys.ph'),
  ('contact_body', 'Want to suggest a profile, correct a detail, or request removal? Reach out and we will take care of it.')
on conflict (key) do nothing;

-- Add the requested account to the app admin allowlist when it exists.
insert into public.admin_users (user_id)
select id from auth.users where lower(email) = 'admin@gmail.com'
on conflict (user_id) do nothing;

insert into public.categories (name, description) values
  ('Sports & Movement', 'People who keep the community moving.'),
  ('Creative Souls', 'Artists, makers, and storytellers.'),
  ('Music & Culture', 'The sounds and rhythms of Sapangan.')
on conflict (name) do nothing;

alter table public.categories enable row level security;
alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.site_content enable row level security;

-- Remove policies from earlier versions before applying the restricted ones.
drop policy if exists "Published profiles are public" on public.profiles;
drop policy if exists "Authenticated admins manage profiles" on public.profiles;
drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "Admins can create profiles" on public.profiles;
drop policy if exists "Admins can update profiles" on public.profiles;
drop policy if exists "Admins can delete profiles" on public.profiles;
drop policy if exists "Categories are public for directory filters" on public.categories;
drop policy if exists "Authenticated admins manage categories" on public.categories;
drop policy if exists "Categories are public" on public.categories;
drop policy if exists "Admins can create categories" on public.categories;
drop policy if exists "Admins can update categories" on public.categories;
drop policy if exists "Admins can delete categories" on public.categories;
drop policy if exists "Admins can read their own admin record" on public.admin_users;
drop policy if exists "Public site content is readable" on public.site_content;
drop policy if exists "Admins can manage site content" on public.site_content;
drop policy if exists "Public profile images are viewable" on storage.objects;
drop policy if exists "Admins upload profile images" on storage.objects;
drop policy if exists "Admins update profile images" on storage.objects;
drop policy if exists "Admins delete profile images" on storage.objects;
drop policy if exists "Admins can upload profile images" on storage.objects;
drop policy if exists "Admins can update profile images" on storage.objects;
drop policy if exists "Admins can delete profile images" on storage.objects;

-- Admin users can see only their own allowlist row; nobody can self-promote.
create policy "Admins can read their own admin record"
on public.admin_users for select to authenticated
using (user_id = (select auth.uid()));

create policy "Public site content is readable"
on public.site_content for select to anon, authenticated
using (true);

create policy "Admins can manage site content"
on public.site_content for all to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

create policy "Published profiles are public"
on public.profiles for select to anon, authenticated
using (is_published = true);

create policy "Admins can read all profiles"
on public.profiles for select to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

create policy "Admins can create profiles"
on public.profiles for insert to authenticated
with check (
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  and (is_published = false or consent_confirmed = true)
);

create policy "Admins can update profiles"
on public.profiles for update to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))
with check (
  exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  and (is_published = false or consent_confirmed = true)
);

create policy "Admins can delete profiles"
on public.profiles for delete to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

create policy "Categories are public"
on public.categories for select to anon, authenticated
using (true);

create policy "Admins can create categories"
on public.categories for insert to authenticated
with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

create policy "Admins can update categories"
on public.categories for update to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

create policy "Admins can delete categories"
on public.categories for delete to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

-- Expose only the intended table operations through the Data API.
grant select on public.categories to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant insert, update, delete on public.profiles to authenticated;
grant insert, update, delete on public.categories to authenticated;
grant select on public.site_content to anon, authenticated;
grant insert, update, delete on public.site_content to authenticated;

-- Enable Supabase Realtime for public profiles and editable site text.
do $$
begin
  if not exists (
    select 1 from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    where p.pubname = 'supabase_realtime' and n.nspname = 'public' and c.relname = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
  if not exists (
    select 1 from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    where p.pubname = 'supabase_realtime' and n.nspname = 'public' and c.relname = 'site_content'
  ) then
    alter publication supabase_realtime add table public.site_content;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from storage.buckets where id = 'profile-images') then
    insert into storage.buckets (id, name, public)
    values ('profile-images', 'profile-images', true);
  end if;
end $$;

create policy "Public profile images are viewable"
on storage.objects for select to anon, authenticated
using (bucket_id = 'profile-images');

create policy "Admins can upload profile images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-images'
  and exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);

create policy "Admins can update profile images"
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-images'
  and exists (select 1 from public.admin_users where user_id = (select auth.uid()))
)
with check (bucket_id = 'profile-images');

create policy "Admins can delete profile images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-images'
  and exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);

-- If admin@gmail.com was created after running the script, run this line once:
-- insert into public.admin_users (user_id)
-- select id from auth.users where lower(email) = 'admin@gmail.com'
-- on conflict (user_id) do nothing;

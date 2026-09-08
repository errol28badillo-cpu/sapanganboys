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

alter table public.profiles add column if not exists gallery_urls text[] not null default '{}';
alter table public.profiles add column if not exists nickname text;
alter table public.profiles add column if not exists location text default 'Sapangan';
alter table public.profiles add column if not exists favorite_sport text;
alter table public.profiles add column if not exists favorite_music text;
alter table public.profiles add column if not exists fun_facts text[] not null default '{}';
alter table public.profiles add column if not exists featured boolean not null default false;
alter table public.profiles add column if not exists views integer not null default 0;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text not null default '',
  date date not null,
  time text,
  location text,
  image_url text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_content (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.categories enable row level security;
alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.events enable row level security;
alter table public.site_content enable row level security;

create policy "Published profiles are public" on public.profiles for select to anon, authenticated using (is_published = true);
create policy "Admins can read all profiles" on public.profiles for select to authenticated using (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
create policy "Admins can create profiles" on public.profiles for insert to authenticated with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())) and (is_published = false or consent_confirmed = true));
create policy "Admins can update profiles" on public.profiles for update to authenticated using (exists (select 1 from public.admin_users where user_id = (select auth.uid()))) with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())) and (is_published = false or consent_confirmed = true));
create policy "Admins can delete profiles" on public.profiles for delete to authenticated using (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
create policy "Categories are public for directory filters" on public.categories for select to anon, authenticated using (true);
create policy "Admins manage categories" on public.categories for all to authenticated using (exists (select 1 from public.admin_users where user_id = (select auth.uid()))) with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
create policy "Admins can read their own admin record" on public.admin_users for select to authenticated using (user_id = (select auth.uid()));
create policy "Published events are public" on public.events for select to anon, authenticated using (is_published = true);
create policy "Admins manage events" on public.events for all to authenticated using (exists (select 1 from public.admin_users where user_id = (select auth.uid()))) with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
create policy "Public site content is readable" on public.site_content for select to anon, authenticated using (true);
create policy "Admins manage site content" on public.site_content for all to authenticated using (exists (select 1 from public.admin_users where user_id = (select auth.uid()))) with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

grant select on public.categories, public.profiles, public.events, public.site_content to anon, authenticated;
grant insert, update, delete on public.profiles, public.categories, public.events, public.site_content to authenticated;

create or replace function public.increment_profile_view(profile_id uuid)
returns void language sql security definer set search_path = public, pg_temp
as $$ update public.profiles set views = views + 1 where id = profile_id and is_published = true; $$;
revoke all on function public.increment_profile_view(uuid) from public;
grant execute on function public.increment_profile_view(uuid) to anon, authenticated;

insert into storage.buckets (id, name, public) values ('profile-images', 'profile-images', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('event-images', 'event-images', true) on conflict (id) do nothing;
create policy "Public profile images are viewable" on storage.objects for select to anon, authenticated using (bucket_id = 'profile-images');
create policy "Admins manage profile images" on storage.objects for all to authenticated using (bucket_id = 'profile-images' and exists (select 1 from public.admin_users where user_id = (select auth.uid()))) with check (bucket_id = 'profile-images' and exists (select 1 from public.admin_users where user_id = (select auth.uid())));
create policy "Public event images are viewable" on storage.objects for select to anon, authenticated using (bucket_id = 'event-images');
create policy "Admins manage event images" on storage.objects for all to authenticated using (bucket_id = 'event-images' and exists (select 1 from public.admin_users where user_id = (select auth.uid()))) with check (bucket_id = 'event-images' and exists (select 1 from public.admin_users where user_id = (select auth.uid())));

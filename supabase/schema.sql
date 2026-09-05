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

alter table public.categories enable row level security;
alter table public.profiles enable row level security;

create policy "Published profiles are public" on public.profiles for select using (is_published = true);
create policy "Categories are public for directory filters" on public.categories for select using (true);
create policy "Authenticated admins manage profiles" on public.profiles for all to authenticated using (true) with check (consent_confirmed = true or is_published = false);
create policy "Authenticated admins manage categories" on public.categories for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public) values ('profile-images', 'profile-images', true) on conflict (id) do nothing;
create policy "Public profile images are viewable" on storage.objects for select using (bucket_id = 'profile-images');
create policy "Admins upload profile images" on storage.objects for insert to authenticated with check (bucket_id = 'profile-images');
create policy "Admins update profile images" on storage.objects for update to authenticated using (bucket_id = 'profile-images');
create policy "Admins delete profile images" on storage.objects for delete to authenticated using (bucket_id = 'profile-images');

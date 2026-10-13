-- Supabase Auth owns email/password credentials. Keep only public member data here.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  phone text not null default '',
  phone_verified boolean not null default false,
  customer_key uuid not null default gen_random_uuid(),
  role text not null default 'customer' check (role in ('customer','owner','merchandiser','fulfillment','support')),
  status text not null default 'active' check (status in ('active','suspended')),
  points_balance integer not null default 0 check (points_balance >= 0),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;
drop policy if exists profiles_own_read on public.profiles;
create policy profiles_own_read on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create or replace function public.fulgere_create_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is null then return new; end if;
  insert into public.profiles(id,email,full_name,phone)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',''),coalesce(new.raw_user_meta_data->>'phone',''))
  on conflict(id) do nothing;
  return new;
end $$;
revoke all on function public.fulgere_create_profile() from public,anon,authenticated;

drop trigger if exists fulgere_on_auth_user_created on auth.users;
create trigger fulgere_on_auth_user_created
  after insert on auth.users for each row execute function public.fulgere_create_profile();

-- Include accounts created before the profile table was installed.
insert into public.profiles(id,email,full_name,phone)
select id,email,coalesce(raw_user_meta_data->>'full_name',''),coalesce(raw_user_meta_data->>'phone','')
from auth.users where email is not null
on conflict(id) do nothing;

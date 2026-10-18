-- One row = one user's profile.
-- Sign-in details (email, Google identity) live in Supabase Auth's auth.users;
-- this table holds only what Treasured shows about the person.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 50),
  last_name text check (last_name is null or char_length(btrim(last_name)) between 1 and 50),
  created_at timestamptz not null default now(),
  last_active_at timestamptz
);

-- Row Level Security: with RLS on and no matching policy, a request sees nothing.
alter table public.profiles enable row level security;

-- auth.uid() is the signed-in user's ID, taken from their session token.
create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can create their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

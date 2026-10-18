-- Last name is now required, like first name (1–50 characters after trimming).
-- Fails if any existing profile has no last name; fix or delete those rows first.
alter table public.profiles drop constraint profiles_last_name_check;

alter table public.profiles
  alter column last_name set not null,
  add constraint profiles_last_name_check check (char_length(btrim(last_name)) between 1 and 50);

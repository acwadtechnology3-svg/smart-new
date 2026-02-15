-- Saved Locations Table
CREATE TABLE IF NOT EXISTS public.saved_locations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) not null,
  type text check (type in ('home', 'work', 'favorite', 'other')) default 'other',
  name text not null, -- e.g. "Home", "Office", "Gym"
  address text not null,
  lat float8 not null,
  lng float8 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS
alter table public.saved_locations enable row level security;

-- Drop generic policies if they exist to avoid conflicts (though new table shouldn't have them)
drop policy if exists "Users can view their own saved locations" on public.saved_locations;
drop policy if exists "Users can insert their own saved locations" on public.saved_locations;
drop policy if exists "Users can update their own saved locations" on public.saved_locations;
drop policy if exists "Users can delete their own saved locations" on public.saved_locations;
drop policy if exists "Enable all access for anon saved_locations" on public.saved_locations;


create policy "Enable all access for anon saved_locations" on public.saved_locations
for all using (true) with check (true); 
-- Note: As per other tables in this project (e.g. users, trips), it seems they use a permissive policy 
-- because the backend controls the logic. Access is controlled by the backend API.


-- Search History Table
CREATE TABLE IF NOT EXISTS public.search_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) not null,
  address text not null,
  lat float8 not null,
  lng float8 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for search history
alter table public.search_history enable row level security;

drop policy if exists "Enable all access for anon search_history" on public.search_history;
create policy "Enable all access for anon search_history" on public.search_history
for all using (true) with check (true);

create table public.trips (id uuid primary key, owner uuid not null);
alter table public.trips enable row level security;
create table public.notes (id uuid primary key, trip_id uuid, body text);
alter table public.notes enable row level security;
create table public.countries (code text primary key);
alter table public.countries enable row level security;
create policy "herkese açık ülke listesi" on public.countries for select using (true);
create policy "kendi notları" on public.notes for all to authenticated
  using (trip_id in (select public.my_trip_ids()))
  with check (trip_id in (select public.my_trip_ids()));
create or replace function public.my_trip_ids() returns setof uuid
language sql security definer set search_path = '' stable
as $$ select id from public.trips where owner = (select auth.uid()); $$;
create view public.trip_summary with (security_invoker = true) as select id from public.trips;
insert into storage.buckets (id, name, public) values ('tickets', 'tickets', false);

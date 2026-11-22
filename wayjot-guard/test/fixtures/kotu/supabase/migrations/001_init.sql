create table public.trips (id uuid primary key, owner uuid not null);
alter table public.trips enable row level security;
create table public.notes (id uuid primary key, trip_id uuid, body text);
create policy "herkes yazar" on public.trips for all using (true);
create or replace function public.my_trip_ids() returns setof uuid
language sql security definer as $$ select id from public.trips $$;
create view public.trip_summary as select id from public.trips;
insert into storage.buckets (id, name, public) values ('tickets', 'tickets', true);

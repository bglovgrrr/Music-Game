-- Side B: full database setup in one file (the same as supabase/migrations/ combined).
-- Use it for a brand-new Supabase project: SQL Editor → New query → paste → Run.
-- Safe to run more than once. Schema changes from now on go in supabase/migrations/.
--
-- How it works:
--   * Players sign in anonymously (no accounts). Their auth user id is their player id.
--   * Each game is one row in `rooms`; the whole game state lives in `state` (JSON).
--   * `room_members` says who is in which room. Row-level security means you can only
--     see and change rooms you are a member of.
--   * You become a member only through create_room() or join_room() (with the code).

-- ---------- Tables ----------
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  host_id uuid not null references auth.users (id) on delete cascade,
  state jsonb not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rooms_code_idx on public.rooms (code, created_at desc);
create index if not exists rooms_host_id_idx on public.rooms (host_id);

create table if not exists public.room_members (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index if not exists room_members_user_idx on public.room_members (user_id);

-- ---------- Security ----------
-- Helper functions live in `private`, which the web API does not expose.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- Remove helpers from older versions of this script that lived in `public`.
drop policy if exists "Members can read their rooms" on public.rooms;
drop policy if exists "Members can update their rooms" on public.rooms;
drop policy if exists "Members can see who is in their rooms" on public.room_members;
drop function if exists public.is_room_member(uuid);
drop function if exists public.pick_player_color(jsonb);

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;

revoke all on public.rooms from anon;
revoke all on public.room_members from anon;
revoke insert, update, delete on public.rooms from authenticated;
revoke insert, update, delete on public.room_members from authenticated;
grant select on public.rooms to authenticated; -- games change only through the room-action Edge Function
grant select on public.room_members to authenticated;

create or replace function private.is_room_member(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.room_members
    where room_id = rid and user_id = (select auth.uid())
  );
$$;

drop policy if exists "Members can read their rooms" on public.rooms;
create policy "Members can read their rooms" on public.rooms
  for select to authenticated using (private.is_room_member(id));

-- No update policy: games change only through the room-action Edge Function
-- (supabase/functions/room-action), which applies the game rules on the server.
drop policy if exists "Members can update their rooms" on public.rooms;

drop policy if exists "Members can see who is in their rooms" on public.room_members;
create policy "Members can see who is in their rooms" on public.room_members
  for select to authenticated using (private.is_room_member(room_id));

-- ---------- Functions the app calls ----------
create or replace function private.pick_player_color(players jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (select c from unnest(array['#cfcaff','#ffc4da','#ffd3b0','#bfe9d6','#fbe39a','#bcdcff','#d7ecb0','#f4c0c0'])
       with ordinality as t(c, i)
     where c not in (select p->>'color' from jsonb_array_elements(players) p)
     order by i limit 1),
    '#cfcaff');
$$;

-- create_room and join_room are the app's only way in. They are SECURITY DEFINER so they can
-- add you to a room, which is why each one checks auth.uid() and is closed to anon.

-- Create a game. The caller becomes the host and first player.
create or replace function public.create_room(player_name text)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  new_code text;
  name text := left(trim(coalesce(player_name, '')), 24);
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  r public.rooms;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if name = '' then raise exception 'Pick a name first'; end if;

  loop
    new_code := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ', floor(random() * 24)::int + 1, 1), '')
                 from generate_series(1, 4));
    exit when not exists (
      select 1 from public.rooms where code = new_code and created_at > now() - interval '2 days');
  end loop;

  insert into public.rooms (code, host_id, state)
  values (new_code, uid, jsonb_build_object(
    'id', gen_random_uuid()::text,
    'code', new_code,
    'hostId', uid::text,
    'phase', 'lobby',
    'players', jsonb_build_array(jsonb_build_object('id', uid::text, 'name', name, 'color', '#cfcaff')),
    'rounds', '[]'::jsonb,
    'turn', 0,
    'playback', jsonb_build_object('isPlaying', false, 'positionMs', 0, 'updatedAt', now_ms),
    'createdAt', now_ms))
  returning * into r;

  insert into public.room_members (room_id, user_id) values (r.id, uid);
  return r;
end;
$$;

-- Join a game with its 4-letter code. Rejoining (e.g. after a refresh) is fine.
create or replace function public.join_room(room_code text, player_name text)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  name text := left(trim(coalesce(player_name, '')), 24);
  r public.rooms;
begin
  if uid is null then raise exception 'Not signed in'; end if;

  select * into r from public.rooms
  where code = upper(trim(room_code)) and created_at > now() - interval '2 days'
  order by created_at desc
  limit 1
  for update;
  if not found then raise exception 'No game found with code %', upper(trim(room_code)); end if;

  if not exists (select 1 from jsonb_array_elements(r.state->'players') p where p->>'id' = uid::text) then
    if name = '' then raise exception 'Pick a name first'; end if;
    if r.state->>'phase' = 'recap' then raise exception 'That game has already ended'; end if;
    if jsonb_array_length(r.state->'players') >= 8 then raise exception 'This game is full'; end if;

    update public.rooms
    set state = jsonb_set(state, '{players}', (state->'players') || jsonb_build_array(jsonb_build_object(
          'id', uid::text, 'name', name, 'color', private.pick_player_color(state->'players')))),
        version = version + 1,
        updated_at = now()
    where id = r.id
    returning * into r;
  end if;

  insert into public.room_members (room_id, user_id) values (r.id, uid) on conflict do nothing;
  return r;
end;
$$;

-- Lets phones line up their clocks so the song progress bar matches everywhere.
create or replace function public.server_time()
returns timestamptz
language sql
stable
set search_path = ''
as $$ select now(); $$;

revoke execute on function public.create_room(text) from public, anon;
revoke execute on function public.join_room(text, text) from public, anon;
revoke execute on function private.is_room_member(uuid) from public, anon;
revoke execute on function private.pick_player_color(jsonb) from public, anon, authenticated;
grant execute on function public.create_room(text) to authenticated;
grant execute on function public.join_room(text, text) to authenticated;
grant execute on function private.is_room_member(uuid) to authenticated; -- used by the row-level security policies
grant execute on function public.server_time() to authenticated, anon;

-- ---------- Live updates ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;
end $$;

-- ---------- Group selfies ----------
-- Group selfies: a private bucket. Files live at "<room id>/<file>", and only members
-- of that room can upload, view (via short-lived signed links) or delete them.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('selfies', 'selfies', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create or replace function private.can_access_room_file(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.room_members m
    where m.room_id::text = (storage.foldername(object_name))[1]
      and m.user_id = (select auth.uid())
  );
$$;

revoke execute on function private.can_access_room_file(text) from public, anon;
grant execute on function private.can_access_room_file(text) to authenticated;

drop policy if exists "Room members can view their selfies" on storage.objects;
create policy "Room members can view their selfies" on storage.objects
  for select to authenticated
  using (bucket_id = 'selfies' and private.can_access_room_file(name));

drop policy if exists "Room members can add selfies" on storage.objects;
create policy "Room members can add selfies" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'selfies' and private.can_access_room_file(name));

drop policy if exists "Room members can delete their selfies" on storage.objects;
create policy "Room members can delete their selfies" on storage.objects
  for delete to authenticated
  using (bucket_id = 'selfies' and private.can_access_room_file(name));

-- ---------- Share links (wraps) ----------

create table if not exists public.shares (
  id text primary key check (id ~ '^[A-Za-z0-9]{10}$'),
  room_id uuid not null unique references public.rooms (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  snapshot jsonb not null check (octet_length(snapshot::text) < 200000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shares_created_by_idx on public.shares (created_by);

-- No direct table access at all: only the two functions below.
alter table public.shares enable row level security;
revoke all on public.shares from anon, authenticated;

-- Create (or refresh) the share for a room you're in. Returns its id.
create or replace function public.create_share(room uuid, snap jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid text;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if not private.is_room_member(room) then raise exception 'Not your game'; end if;
  if octet_length(snap::text) >= 200000 then raise exception 'Too big to share'; end if;

  select id into sid from public.shares where room_id = room;
  if sid is null then
    sid := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789', floor(random() * 57)::int + 1, 1), '')
            from generate_series(1, 10));
    insert into public.shares (id, room_id, created_by, snapshot) values (sid, room, uid, snap);
  else
    update public.shares set snapshot = snap, updated_at = now() where id = sid;
  end if;
  return sid;
end;
$$;

-- Read one share by its id (the link). Open to anyone, including signed-out visitors.
create or replace function public.get_share(share_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select snapshot from public.shares where id = share_id;
$$;

revoke execute on function public.create_share(uuid, jsonb) from public, anon;
grant execute on function public.create_share(uuid, jsonb) to authenticated;
revoke execute on function public.get_share(text) from public;
grant execute on function public.get_share(text) to anon, authenticated;

-- The link preview image (the recap card, drawn without selfies). Public to read so
-- chat apps can show it; only a member of the shared game can upload it, as "<share id>.png".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wraps', 'wraps', true, 3145728, array['image/png'])
on conflict (id) do nothing;

create or replace function private.can_write_wrap(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shares s
    where s.id || '.png' = object_name
      and private.is_room_member(s.room_id)
  );
$$;
revoke execute on function private.can_write_wrap(text) from public, anon;
grant execute on function private.can_write_wrap(text) to authenticated;

drop policy if exists "Players can upload their wrap card" on storage.objects;
create policy "Players can upload their wrap card" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'wraps' and private.can_write_wrap(name));

drop policy if exists "Players can replace their wrap card" on storage.objects;
create policy "Players can replace their wrap card" on storage.objects
  for update to authenticated
  using (bucket_id = 'wraps' and private.can_write_wrap(name))
  with check (bucket_id = 'wraps' and private.can_write_wrap(name));

-- Upserts read the existing object first.
drop policy if exists "Players can see their wrap card" on storage.objects;
create policy "Players can see their wrap card" on storage.objects
  for select to authenticated
  using (bucket_id = 'wraps' and private.can_write_wrap(name));

-- ---------- Retention and rate limits (same as migration 20261109020000) ----------
-- 1. A share link outlives its game: deleting a game keeps the share's snapshot (no selfies
--    or notes in it) and just clears its link to the game.
alter table public.shares drop constraint if exists shares_room_id_fkey;
alter table public.shares alter column room_id drop not null;
alter table public.shares add constraint shares_room_id_fkey foreign key (room_id) references public.rooms (id) on delete set null;

-- Lookups for the clean-up job.
create index if not exists rooms_created_at_idx on public.rooms (created_at);
create index if not exists shares_created_at_idx on public.shares (created_at);

-- 2. Rate limit: at most 10 new games per player per hour.
create or replace function public.create_room(player_name text)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  new_code text;
  name text := left(trim(coalesce(player_name, '')), 24);
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  r public.rooms;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if name = '' then raise exception 'Pick a name first'; end if;
  if (select count(*) from public.rooms where host_id = uid and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'That''s a lot of new games. Try again in a little while.';
  end if;

  loop
    new_code := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ', floor(random() * 24)::int + 1, 1), '')
                 from generate_series(1, 4));
    exit when not exists (
      select 1 from public.rooms where code = new_code and created_at > now() - interval '2 days');
  end loop;

  insert into public.rooms (code, host_id, state)
  values (new_code, uid, jsonb_build_object(
    'id', gen_random_uuid()::text,
    'code', new_code,
    'hostId', uid::text,
    'phase', 'lobby',
    'players', jsonb_build_array(jsonb_build_object('id', uid::text, 'name', name, 'color', '#cfcaff')),
    'rounds', '[]'::jsonb,
    'turn', 0,
    'playback', jsonb_build_object('isPlaying', false, 'positionMs', 0, 'updatedAt', now_ms),
    'createdAt', now_ms))
  returning * into r;

  insert into public.room_members (room_id, user_id) values (r.id, uid);
  return r;
end;
$$;
revoke execute on function public.create_room(text) from public, anon;
grant execute on function public.create_room(text) to authenticated;

-- 3. Daily clean-up (04:23 UTC): the cleanup Edge Function deletes games, notes and selfies
--    30 days after they started, and share links after a year (see /privacy).
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select cron.unschedule('mixtape-cleanup') where exists (select 1 from cron.job where jobname = 'mixtape-cleanup');
select cron.schedule(
  'mixtape-cleanup',
  '23 4 * * *',
  $job$ select net.http_post(url := 'https://iizvvvzccqttwlvqkfzi.supabase.co/functions/v1/cleanup', headers := '{"Content-Type": "application/json"}'::jsonb, body := '{}'::jsonb) $job$
);

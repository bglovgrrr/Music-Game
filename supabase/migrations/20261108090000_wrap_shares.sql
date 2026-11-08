-- Shareable "wraps": a public, read-only snapshot of a finished game.
-- The snapshot is written by a player of that room (no selfies, no notes; the app builds it).
-- Anyone with the short link can read it through get_share(); nobody can list shares.

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

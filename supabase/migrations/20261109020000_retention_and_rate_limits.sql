-- Data retention and rate limits.

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

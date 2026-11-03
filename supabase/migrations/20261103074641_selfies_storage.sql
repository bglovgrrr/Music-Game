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

create policy "Room members can view their selfies" on storage.objects
  for select to authenticated
  using (bucket_id = 'selfies' and private.can_access_room_file(name));

create policy "Room members can add selfies" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'selfies' and private.can_access_room_file(name));

create policy "Room members can delete their selfies" on storage.objects
  for delete to authenticated
  using (bucket_id = 'selfies' and private.can_access_room_file(name));

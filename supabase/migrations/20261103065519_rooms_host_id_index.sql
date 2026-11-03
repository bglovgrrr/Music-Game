-- Index for the rooms.host_id foreign key (Supabase performance advisor).
create index if not exists rooms_host_id_idx on public.rooms (host_id);

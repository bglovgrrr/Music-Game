-- Games change only through the room-action Edge Function, which checks the player is in the
-- game and applies the game rules on the server. Phones can still read their games (and get
-- live updates), but can no longer write them directly, so nobody can hand-edit a game.
drop policy if exists "Members can update their rooms" on public.rooms;
revoke update on public.rooms from authenticated;

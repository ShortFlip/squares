-- Add rooms + games to the realtime publication.
--
-- Why: game state is fanned out over broadcast events, which are fire-and-forget.
-- A client whose tab was asleep or briefly offline never receives them and gets
-- stuck on a stale screen. useRealtimeRoom now also subscribes to postgres_changes
-- on these two tables so it can recover room status and call progress from the DB.
--
-- Guarded so re-running the migration on a project where the tables were already
-- added by hand (via the dashboard) is a no-op rather than an error.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'games'
  ) then
    alter publication supabase_realtime add table public.games;
  end if;
end $$;

-- Realtime only sends the columns present in the WAL record. Without REPLICA
-- IDENTITY FULL an UPDATE payload can omit unchanged columns (like games.id),
-- which the client uses to match the row to the current round.
alter table public.rooms replica identity full;
alter table public.games replica identity full;

-- =============================================================================
-- MVP: Open update policies — remove auth.uid() requirement
-- =============================================================================
-- rooms UPDATE was still gated on auth.uid() so status never changed to
-- 'playing', leaving the lobby stuck on "Starting…".
-- =============================================================================

drop policy if exists "rooms: host can update" on public.rooms;

create policy "rooms: host can update"
  on public.rooms for update
  using (true);

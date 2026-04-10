-- =============================================================================
-- Fix players update policy to allow auth_id backfill
-- =============================================================================
-- When a player record was created before anonymous auth was enabled,
-- auth_id is null. The original policy required auth.uid() = auth_id, which
-- fails when auth_id IS null (SQL null comparison is always falsy).
--
-- New rule: allow update if we have a session AND either:
--   (a) auth_id is already null (claiming identity for the first time), or
--   (b) auth_id matches the current session (normal self-update)
-- =============================================================================

drop policy if exists "players: owner can update" on public.players;

create policy "players: owner can update"
  on public.players for update
  using (
    auth.uid() is not null
    and (auth_id is null or auth_id = auth.uid())
  )
  with check (
    auth.uid() is not null
    and (auth_id is null or auth_id = auth.uid())
  );

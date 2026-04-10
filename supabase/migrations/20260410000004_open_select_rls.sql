-- =============================================================================
-- MVP: Open select policies — remove auth.uid() requirement
-- =============================================================================
-- Anonymous sign-ins are disabled in this project, so auth.uid() is always
-- null, making private template/room selects return empty. For the MVP
-- friend-group use case, open up reads to everyone.
-- Tighten post-MVP when proper auth is wired up.
-- =============================================================================

-- ── card_templates ─────────────────────────────────────────────────────────

drop policy if exists "card_templates: select" on public.card_templates;

create policy "card_templates: select"
  on public.card_templates for select
  using (true);

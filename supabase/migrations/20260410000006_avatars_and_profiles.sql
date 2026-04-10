-- =============================================================================
-- Avatars storage bucket + open players update for MVP
-- =============================================================================

-- Create a public avatars bucket (5 MB max, images only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Storage RLS — open for MVP (no auth gate)
create policy "avatars: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars: anyone can upload"
  on storage.objects for insert
  with check (bucket_id = 'avatars');

create policy "avatars: anyone can update"
  on storage.objects for update
  using (bucket_id = 'avatars');

create policy "avatars: anyone can delete"
  on storage.objects for delete
  using (bucket_id = 'avatars');

-- Open players update — auth.uid() is always null without anonymous auth
drop policy if exists "players: owner can update" on public.players;

create policy "players: owner can update"
  on public.players for update
  using (true)
  with check (true);

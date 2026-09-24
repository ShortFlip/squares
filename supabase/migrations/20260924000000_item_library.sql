-- Item Library: one tagged pool of items per player, plus saved-card columns.
--
-- Why: a bingo list used to live inside one card_templates row, so a pasted
-- list was one card forever and the same item was retyped for every card. The
-- library keeps every item once, tagged with at most one game (which gives the
-- square its tint and icon on the board) and any number of extra tags (which
-- only filter the library). Cards are built from it on /library and saved back
-- to card_templates, which already holds a name, size, free space, style and an
-- items snapshot: exactly a saved card. Spec: docs/plans/item-library.md; the
-- shapes below are the "Settled data shapes" in docs/plans/item-library-build.md.

-- ---------------------------------------------------------------------------
-- TAGS
-- kind 'game' = the one game an item belongs to (colour + icon on the board);
-- kind 'tag' = an extra filter label. Names are unique per owner ignoring case
-- so "Rocket League" and "rocket league" can never become two games.
-- ---------------------------------------------------------------------------
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.players(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  kind text not null default 'tag' check (kind in ('game', 'tag')),
  color text,          -- game tags only: a GameColorKey, never raw CSS
  icon text,           -- game tags only: a GameIconKey
  created_at timestamptz not null default now()
);
create unique index tags_owner_name_key on public.tags (owner_id, lower(name));

-- ---------------------------------------------------------------------------
-- LIBRARY ITEMS
-- Unique per owner ignoring case, so Import List can skip what is already
-- there ("22 added, 2 already in your library") instead of piling up repeats.
-- game_tag_id is nulled rather than cascaded when a game is deleted: the item
-- survives and falls back to the No Game lane.
-- ---------------------------------------------------------------------------
create table public.library_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.players(id) on delete cascade,
  text text not null check (length(btrim(text)) > 0),
  game_tag_id uuid references public.tags(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index library_items_owner_text_key on public.library_items (owner_id, lower(text));

-- ---------------------------------------------------------------------------
-- LIBRARY ITEM TAGS
-- The extra tags only. The game lives on library_items.game_tag_id so "at most
-- one game per item" is a column, not a rule the app has to remember.
-- ---------------------------------------------------------------------------
create table public.library_item_tags (
  item_id uuid not null references public.library_items(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (item_id, tag_id)
);

-- ---------------------------------------------------------------------------
-- SAVED CARDS
-- Every existing template is a saved card, hence the default of true. A card
-- hosted without being saved is written as saved = false so the room still has
-- a template_id (first round, New Round and reconnect all read the template by
-- rooms.template_id) without cluttering Saved Cards. mix is the CardMix the card
-- was built with; legacy cards have none.
-- ---------------------------------------------------------------------------
alter table public.card_templates
  add column saved boolean not null default true,  -- false = a one-night copy
  add column mix jsonb;                            -- CardMix, null on legacy cards

-- =============================================================================
-- ROW LEVEL SECURITY
-- Same stance as card_templates: reads and inserts are open (anonymous sign-in
-- is unreliable here, see 20260410000003/4), while update and delete check the
-- owner through the caller's auth session. "Owner only" browsing is a filter in
-- the app, the same honour system as the rest (docs/decisions/0002). Note that
-- a failed owner check blocks silently (0 rows, no error), so app code must
-- check the returned row count.
-- =============================================================================

alter table public.tags              enable row level security;
alter table public.library_items     enable row level security;
alter table public.library_item_tags enable row level security;

-- ── tags ───────────────────────────────────────────────────────────────────

create policy "tags: select"
  on public.tags for select
  using (true);

create policy "tags: insert"
  on public.tags for insert
  with check (true);

create policy "tags: update"
  on public.tags for update
  using (
    auth.uid() is not null
    and owner_id = (select id from public.players where auth_id = auth.uid() limit 1)
  );

create policy "tags: delete"
  on public.tags for delete
  using (
    auth.uid() is not null
    and owner_id = (select id from public.players where auth_id = auth.uid() limit 1)
  );

-- ── library_items ──────────────────────────────────────────────────────────

create policy "library_items: select"
  on public.library_items for select
  using (true);

create policy "library_items: insert"
  on public.library_items for insert
  with check (true);

create policy "library_items: update"
  on public.library_items for update
  using (
    auth.uid() is not null
    and owner_id = (select id from public.players where auth_id = auth.uid() limit 1)
  );

create policy "library_items: delete"
  on public.library_items for delete
  using (
    auth.uid() is not null
    and owner_id = (select id from public.players where auth_id = auth.uid() limit 1)
  );

-- ── library_item_tags ──────────────────────────────────────────────────────
-- A link row has no owner of its own; it belongs to whoever owns the item.

create policy "library_item_tags: select"
  on public.library_item_tags for select
  using (true);

create policy "library_item_tags: insert"
  on public.library_item_tags for insert
  with check (true);

create policy "library_item_tags: update"
  on public.library_item_tags for update
  using (
    auth.uid() is not null
    and exists (
      select 1 from public.library_items i
      where i.id = library_item_tags.item_id
        and i.owner_id = (select id from public.players where auth_id = auth.uid() limit 1)
    )
  );

create policy "library_item_tags: delete"
  on public.library_item_tags for delete
  using (
    auth.uid() is not null
    and exists (
      select 1 from public.library_items i
      where i.id = library_item_tags.item_id
        and i.owner_id = (select id from public.players where auth_id = auth.uid() limit 1)
    )
  );

-- =============================================================================
-- ONE-TIME IMPORT: existing templates → library
-- =============================================================================
-- Why: the lists Ryann already typed must be in the library on day one, or the
-- library page opens empty and he retypes everything. Each template becomes an
-- extra tag named after it, so "the items from my Warzone card" is still one
-- click. Game tags are NOT created or guessed from names: a wrong guess would
-- tint squares with the wrong game, and he assigns games in bulk on /library.
-- The templates themselves are untouched; they keep working as saved cards.
--
-- Rules, mirrored by .playwright-mcp/library-import-check.cjs:
--   * Whitespace means ASCII space, tab, LF, CR, form feed and vertical tab,
--     trimmed from both ends. btrim with an explicit set rather than the
--     default (spaces only) because pasted lists carry tabs and stray newlines;
--     a regex class would depend on the database locale.
--   * items is expected to be a jsonb array of objects with an optional
--     string "text". Anything else (a non-array items value, a non-object
--     element, a non-string text) is skipped rather than cast: jsonb_typeof
--     guards every step so one malformed row cannot abort the migration.
--   * The free-space slot ("isFreeSpace": true) is a runtime sentinel, not an
--     item, and blank text is an empty editor slot; both are skipped.
--   * Duplicates merge per owner ignoring case. The surviving spelling is the
--     one from the owner's earliest template (created_at, then id, then
--     position in the list), because that is the list he wrote first.
--   * Imported rows take the source template's created_at, not now(), so any
--     ordering by created_at reflects when he actually wrote them instead of
--     giving the whole import one identical timestamp.
--   * A template with a blank name still contributes items; it just gets no tag.
-- =============================================================================

-- Staging: one row per importable item occurrence. A temp table rather than a
-- repeated CTE so the item insert and the link insert read identical rows.
-- Dropped explicitly at the end instead of "on commit drop", which would drop
-- it immediately if a runner ever executed this outside a transaction.
create temporary table library_import_src as
select
  t.creator_id as owner_id,
  t.id         as template_id,
  t.created_at as template_created_at,
  e.ord        as item_position,
  -- The template's tag key; null for a blank name so it joins to no tag.
  nullif(lower(btrim(t.name, E' \t\n\r\f\x0B')), '') as tag_key,
  btrim(e.elem ->> 'text', E' \t\n\r\f\x0B')           as item_text
from public.card_templates t
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(t.items) = 'array' then t.items else '[]'::jsonb end
) with ordinality as e(elem, ord)
where jsonb_typeof(e.elem) = 'object'
  and jsonb_typeof(e.elem -> 'text') = 'string'
  -- jsonb equality, not a ::boolean cast, so a malformed flag cannot error.
  and e.elem -> 'isFreeSpace' is distinct from 'true'::jsonb
  and btrim(e.elem ->> 'text', E' \t\n\r\f\x0B') <> '';

-- One extra tag per distinct template name per owner. distinct on keeps the
-- earliest template's spelling; the stored name is trimmed, so the unique index
-- on lower(name) sees exactly the key deduped on here.
insert into public.tags (owner_id, name, kind, created_at)
select distinct on (t.creator_id, lower(btrim(t.name, E' \t\n\r\f\x0B')))
  t.creator_id,
  btrim(t.name, E' \t\n\r\f\x0B'),
  'tag',
  t.created_at
from public.card_templates t
where btrim(t.name, E' \t\n\r\f\x0B') <> ''
order by t.creator_id, lower(btrim(t.name, E' \t\n\r\f\x0B')), t.created_at, t.id;

-- One library item per distinct text per owner, earliest spelling wins.
-- game_tag_id stays null: games are assigned by hand, never guessed.
insert into public.library_items (owner_id, text, created_at)
select distinct on (s.owner_id, lower(s.item_text))
  s.owner_id,
  s.item_text,
  s.template_created_at
from library_import_src s
order by s.owner_id, lower(s.item_text), s.template_created_at, s.template_id, s.item_position;

-- Link every item to the tag of every template it appeared in. distinct because
-- an item can repeat inside one template, and two templates can share a name.
-- The tables were created above, so every row matched here is an imported one.
insert into public.library_item_tags (item_id, tag_id)
select distinct i.id, g.id
from library_import_src s
join public.library_items i
  on i.owner_id = s.owner_id and lower(i.text) = lower(s.item_text)
join public.tags g
  on g.owner_id = s.owner_id and g.kind = 'tag' and lower(g.name) = s.tag_key;

drop table library_import_src;

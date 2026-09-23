-- One round number per room.
--
-- Why: the next round number used to come from the host's local store, so a
-- host who refreshed on Game Over (empty store) and hit Play Again inserted a
-- second "round 1". The reconnect read then ordered by round_number and could
-- load the old, finished round instead of the live one. RoomClient now reads
-- max(round_number) from the DB and the reconnect orders by started_at; this
-- constraint makes a duplicate impossible rather than merely unlikely (two
-- host tabs racing Play Again, a future code path forgetting the rule).
--
-- Existing data: a read-only check on 2026-09-23 found 2 rooms that already
-- have a duplicated round number, which would make the constraint fail to
-- apply. Those rooms (and only those) are renumbered 1..n in started_at order
-- first — the order the rounds were actually played. Rooms without a duplicate
-- keep their numbers exactly, gaps included.
with dup_rooms as (
  select room_id
  from public.games
  group by room_id, round_number
  having count(*) > 1
),
renumbered as (
  select id,
         row_number() over (partition by room_id order by started_at, id) as new_round
  from public.games
  where room_id in (select room_id from dup_rooms)
)
update public.games g
set round_number = r.new_round
from renumbered r
where g.id = r.id
  and g.round_number is distinct from r.new_round;

alter table public.games
  add constraint games_room_id_round_number_key unique (room_id, round_number);

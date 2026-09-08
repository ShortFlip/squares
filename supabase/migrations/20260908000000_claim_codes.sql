-- Claim codes: let one person be themselves on a second machine.
--
-- Identity is a localStorage `browser_id` (see src/lib/utils/browser-id.ts), so
-- opening Squares on a different PC creates a brand new player and orphans your
-- history. A claim code is a short, readable string you can type on the new PC:
-- the app looks the row up by code and writes THAT row's browser_id into the new
-- machine's localStorage. Nothing is written back to the database, so both
-- machines stay linked to the same player rather than one stealing the other.

-- Same unambiguous alphabet as room codes (src/lib/game/room-code.ts): no O, 0,
-- I, 1 or L, because these get read aloud over a call and typed by hand.
create or replace function public.generate_claim_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text := '';
  i int;
begin
  -- 8 chars from a 31-char alphabet is ~10^12 combinations. random() rather than
  -- pgcrypto's gen_random_bytes because pgcrypto lives in the `extensions`
  -- schema on Supabase and is not on this function's search_path; at
  -- three-friends scale a non-cryptographic draw is plenty.
  for i in 1..8 loop
    code := code || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
  end loop;
  return code;
end;
$$;

alter table public.players add column if not exists claim_code text;

-- Fill on insert so the app never has to think about it. Collisions are
-- statistically absent at this scale, but retrying five times costs nothing and
-- turns a freak duplicate into a silent success instead of a failed signup.
create or replace function public.set_claim_code()
returns trigger
language plpgsql
as $$
declare
  candidate text;
  attempt int;
begin
  if new.claim_code is not null then
    return new;
  end if;
  for attempt in 1..5 loop
    candidate := public.generate_claim_code();
    if not exists (select 1 from public.players where claim_code = candidate) then
      new.claim_code := candidate;
      return new;
    end if;
  end loop;
  -- Give up on uniqueness rather than blocking the insert; the unique index
  -- below is the real guarantee and would surface a genuine problem loudly.
  new.claim_code := candidate;
  return new;
end;
$$;

drop trigger if exists players_set_claim_code on public.players;
create trigger players_set_claim_code
  before insert on public.players
  for each row execute function public.set_claim_code();

-- Backfill everyone who already exists, then make the column a hard promise so
-- the UI can render it without a null branch.
update public.players set claim_code = public.generate_claim_code() where claim_code is null;

create unique index if not exists players_claim_code_key on public.players (claim_code);
alter table public.players alter column claim_code set not null;

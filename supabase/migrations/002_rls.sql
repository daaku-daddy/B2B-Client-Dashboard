-- B2B Client Dashboard — row level security
-- Target project: vmwvxwqzqxhwesjokztf. Run AFTER 001_init.sql.
--
-- The whole file is idempotent (every policy is dropped before it is created),
-- so re-run it after any change rather than editing policies by hand.
--
-- The rule this file enforces, in one sentence: a signed-in user sees exactly
-- the rows belonging to the partner firms they are a member of, and nothing
-- else — no other architect's clients, projects, prices or margins.

-- ----------------------------------------------- ownership helper functions
-- All SECURITY DEFINER so a policy can walk the ownership chain without
-- needing SELECT rights on the intermediate tables (which is what causes
-- "infinite recursion detected in policy" errors).

create or replace function app_owns_project(pid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from project p
    where p.id = pid and p.partner_id in (select app_partner_ids())
  )
$$;

create or replace function app_owns_area(aid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from project_area a join project p on p.id = a.project_id
    where a.id = aid and p.partner_id in (select app_partner_ids())
  )
$$;

create or replace function app_owns_board(bid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from board b
      join project_area a on a.id = b.area_id
      join project p on p.id = a.project_id
    where b.id = bid and p.partner_id in (select app_partner_ids())
  )
$$;

create or replace function app_owns_quote(qid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from quote q join project p on p.id = q.project_id
    where q.id = qid and p.partner_id in (select app_partner_ids())
  )
$$;

create or replace function app_owns_referral(rid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from referral r
    where r.id = rid and r.partner_id in (select app_partner_ids())
  )
$$;

-- --------------------------------------------------------------- onboarding
-- A user cannot INSERT into partner_user directly — that would let anyone join
-- any firm by guessing an id. Signing up goes through this instead: it creates
-- the firm and links the caller as its principal, in one transaction, and
-- refuses if the caller is already a member of something.
create or replace function onboard_partner(
  p_firm_name    text,
  p_contact_name text,
  p_phone        text,
  p_email        text default null,
  p_city         text default null,
  p_firm_type    text default 'architect',
  p_gst          text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
  v_phone text := regexp_replace(coalesce(p_phone,''), '\D', '', 'g');
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if exists (select 1 from partner_user where user_id = v_uid) then
    raise exception 'this login already belongs to a firm';
  end if;

  -- Accept 91XXXXXXXXXX / +91… and store the bare ten digits, because the ten
  -- digits are the exact key Material Depot's own systems join on.
  if length(v_phone) > 10 then
    v_phone := right(v_phone, 10);
  end if;
  if v_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'phone must be a 10-digit Indian mobile number';
  end if;

  -- An existing firm with this phone means someone is adding a second login to
  -- a firm that already exists. That is a real case, but it is not self-serve:
  -- it needs whoever owns the firm to say yes, so refuse and say why.
  if exists (select 1 from partner where phone = v_phone) then
    raise exception 'a firm is already registered on %; ask Material Depot to add your login to it', v_phone;
  end if;

  insert into partner (firm_name, contact_name, phone, email, city, firm_type, gst)
  values (p_firm_name, p_contact_name, v_phone, p_email, p_city, p_firm_type, p_gst)
  returning id into v_id;

  insert into partner_user (user_id, partner_id, role) values (v_uid, v_id, 'principal');
  return v_id;
end $$;

revoke all on function onboard_partner(text,text,text,text,text,text,text) from public;
grant execute on function onboard_partner(text,text,text,text,text,text,text) to authenticated;

-- ------------------------------------------------------------------ enable
do $$
declare t text;
begin
  foreach t in array array[
    'partner','partner_user','client','project','project_area','board','board_item',
    'quote','quote_line','procurement_item','finance_entry',
    'referral','referral_event','referral_order','reward_tier','reward_claim'
  ] loop
    execute format('alter table %I enable row level security', t);
    -- Deliberately NOT `force row level security`. FORCE applies RLS to the
    -- table owner as well, which makes the Supabase SQL Editor return nothing
    -- for these tables and reads as "the data is gone". The anon/authenticated
    -- roles are already covered by ENABLE; forcing it buys nothing here and
    -- costs an afternoon the first time someone debugs an empty table.
  end loop;
end $$;

-- ---------------------------------------------------------------- policies

drop policy if exists partner_read on partner;
create policy partner_read on partner for select to authenticated
  using (app_is_member(id));

drop policy if exists partner_write on partner;
create policy partner_write on partner for update to authenticated
  using (app_can_write(id)) with check (app_can_write(id));

-- Read your own membership rows only. No insert/update/delete: joining a firm
-- goes through onboard_partner, and adding a colleague is a support action.
drop policy if exists partner_user_read on partner_user;
create policy partner_user_read on partner_user for select to authenticated
  using (user_id = auth.uid() or partner_id in (select app_partner_ids()));

-- Tables keyed directly on partner_id ------------------------------------
do $$
declare t text;
begin
  foreach t in array array['client','project','referral'] loop
    execute format('drop policy if exists %I_read on %I', t, t);
    execute format($f$create policy %I_read on %I for select to authenticated
      using (partner_id in (select app_partner_ids()))$f$, t, t);

    execute format('drop policy if exists %I_insert on %I', t, t);
    execute format($f$create policy %I_insert on %I for insert to authenticated
      with check (app_can_write(partner_id))$f$, t, t);

    execute format('drop policy if exists %I_update on %I', t, t);
    execute format($f$create policy %I_update on %I for update to authenticated
      using (app_can_write(partner_id)) with check (app_can_write(partner_id))$f$, t, t);

    execute format('drop policy if exists %I_delete on %I', t, t);
    execute format($f$create policy %I_delete on %I for delete to authenticated
      using (app_can_write(partner_id))$f$, t, t);
  end loop;
end $$;

-- Tables one hop from project -------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['project_area','quote','procurement_item','finance_entry'] loop
    execute format('drop policy if exists %I_all on %I', t, t);
    execute format($f$create policy %I_all on %I for all to authenticated
      using (app_owns_project(project_id)) with check (app_owns_project(project_id))$f$, t, t);
  end loop;
end $$;

drop policy if exists board_all on board;
create policy board_all on board for all to authenticated
  using (app_owns_area(area_id)) with check (app_owns_area(area_id));

drop policy if exists board_item_all on board_item;
create policy board_item_all on board_item for all to authenticated
  using (app_owns_board(board_id)) with check (app_owns_board(board_id));

drop policy if exists quote_line_all on quote_line;
create policy quote_line_all on quote_line for all to authenticated
  using (app_owns_quote(quote_id)) with check (app_owns_quote(quote_id));

-- Synced-in tables: read only. The sync route uses the service-role key, which
-- bypasses RLS, so it needs no policy of its own. A partner must never be able
-- to write these — they are what the incentive payout is computed from.
drop policy if exists referral_event_read on referral_event;
create policy referral_event_read on referral_event for select to authenticated
  using (app_owns_referral(referral_id));

drop policy if exists referral_order_read on referral_order;
create policy referral_order_read on referral_order for select to authenticated
  using (app_owns_referral(referral_id));

drop policy if exists reward_claim_read on reward_claim;
create policy reward_claim_read on reward_claim for select to authenticated
  using (partner_id in (select app_partner_ids()));

-- The scheme itself is public to anyone signed in.
drop policy if exists reward_tier_read on reward_tier;
create policy reward_tier_read on reward_tier for select to authenticated
  using (active);

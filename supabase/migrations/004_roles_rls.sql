-- B2B Client Dashboard — row level security for the staff console.
-- Target project: vmwvxwqzqxhwesjokztf. Run AFTER 003_roles.sql.
--
-- Idempotent: every policy is dropped before it is created. Re-run this file
-- after any change rather than editing a policy by hand.
--
-- Two sentences hold this file together.
--
-- **A partner sees their own firm and nothing else** — unchanged from 002.
--
-- **Material Depot's staff see the RELATIONSHIP, never the work.** A KAM, an
-- outreach manager and an admin can read a firm's profile, the clients that firm
-- referred to us, those clients' orders, the firm's rewards and the firm's
-- portfolio. They cannot read the firm's own clients, projects, rooms, boards,
-- quotes, procurement or ledger — the numbers an architect would not put in a
-- supplier's portal if a supplier could read them. There is no policy in this
-- file for those tables and there must never be one; `supabase/test/rlstest.js`
-- checks each of them by name.

-- ================================================== enable on the new tables

do $$
declare t text;
begin
  foreach t in array array[
    'staff_user','partner_application','outreach_prospect','outreach_touch',
    'portfolio_item','partner_activity'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ================================== the fields a firm does not get to set

-- `partner` has one UPDATE policy for the firm itself and one for admins, and
-- RLS cannot restrict an update to some columns. So the columns Material Depot
-- owns — who the KAM is, which market the firm is in, whether the full
-- workspace is on, the CRM link, and the phone number every referral is matched
-- against — are frozen by a trigger instead.
--
-- Without this, `partner_write` (which a firm needs, to edit its own name and
-- studio profile) would also let a firm reassign its own KAM and switch its own
-- modules on. BEFORE UPDATE only: provisioning inserts a partner row with the
-- service role, and an insert must not trip this.
create or replace function partner_guard_md_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- `auth.uid()` is null for the service role and for anything pasted into the
  -- SQL Editor: not an end user, so not something this guard is for. Every
  -- signed-in route into this table goes through a policy that is `to
  -- authenticated` and needs a uid, so null here cannot be a partner.
  if auth.uid() is null or app_is_admin() then return new; end if;
  if new.phone             is distinct from old.phone
     or new.market            is distinct from old.market
     or new.kam_user_id       is distinct from old.kam_user_id
     or new.workspace_enabled is distinct from old.workspace_enabled
     or new.md_client_id      is distinct from old.md_client_id
     or new.onboarding_source is distinct from old.onboarding_source
     or new.onboarded_by      is distinct from old.onboarded_by
     or new.internal_note     is distinct from old.internal_note
  then
    raise exception 'that field is set by Material Depot, not by the firm'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists partner_guard on partner;
create trigger partner_guard before update on partner
  for each row execute function partner_guard_md_fields();

-- ============================================ onboard_partner refuses staff

-- A Material Depot login that walked through the sign-up form would create a
-- firm and then see the partner app instead of the console. Refuse, and say
-- which thing they are.
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
  if exists (select 1 from staff_user where user_id = v_uid) then
    raise exception 'this is a Material Depot staff login — it cannot also be a partner firm';
  end if;
  if exists (select 1 from partner_user where user_id = v_uid) then
    raise exception 'this login already belongs to a firm';
  end if;

  if length(v_phone) > 10 then
    v_phone := right(v_phone, 10);
  end if;
  if v_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'phone must be a 10-digit Indian mobile number';
  end if;

  if exists (select 1 from partner where phone = v_phone) then
    raise exception 'a firm is already registered on %; ask Material Depot to add your login to it', v_phone;
  end if;

  insert into partner (firm_name, contact_name, phone, email, city, firm_type, gst, onboarding_source)
  values (p_firm_name, p_contact_name, v_phone, p_email, p_city, p_firm_type, p_gst, 'self_signup')
  returning id into v_id;

  insert into partner_user (user_id, partner_id, role) values (v_uid, v_id, 'principal');
  return v_id;
end $$;

revoke all on function onboard_partner(text,text,text,text,text,text,text) from public;
grant execute on function onboard_partner(text,text,text,text,text,text,text) to authenticated;

-- ===================================================== who my KAM is

-- A partner must be able to reach the person who looks after them, without
-- being able to read the staff table. One row, theirs, or nothing.
create or replace function my_kam()
returns table (name text, phone text, email text, market text)
language sql security definer set search_path = public stable as $$
  select s.name, s.phone, s.email, s.market
  from partner p
  join staff_user s on s.user_id = p.kam_user_id and s.active
  where p.id in (select app_partner_ids())
  limit 1
$$;
revoke all on function my_kam() from public;
grant execute on function my_kam() to authenticated;

-- ===================================================== staff_user policies

-- Any active staff member can see the team — they have to pick a KAM from a
-- list and read each other's names off a queue. Writes go through the
-- provisioning route with the service role, after an admin check in app code,
-- so there is no insert or update policy at all.
drop policy if exists staff_user_read on staff_user;
create policy staff_user_read on staff_user for select to authenticated
  using (app_is_staff());

-- ============================================= staff read on partner-side

-- Scope, in one place: an admin sees every firm; anyone else sees the firms in
-- their market, plus any firm they are personally the KAM for.
drop policy if exists partner_staff_read on partner;
create policy partner_staff_read on partner for select to authenticated
  using (app_covers_market(market) or kam_user_id = auth.uid());

drop policy if exists partner_admin_write on partner;
create policy partner_admin_write on partner for update to authenticated
  using (app_is_admin()) with check (app_is_admin());

create or replace function app_staff_sees_referral(rid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from referral r where r.id = rid and app_staff_sees_partner(r.partner_id)
  )
$$;

drop policy if exists referral_staff_read on referral;
create policy referral_staff_read on referral for select to authenticated
  using (app_staff_sees_partner(partner_id));

drop policy if exists referral_order_staff_read on referral_order;
create policy referral_order_staff_read on referral_order for select to authenticated
  using (app_staff_sees_referral(referral_id));

drop policy if exists referral_event_staff_read on referral_event;
create policy referral_event_staff_read on referral_event for select to authenticated
  using (app_staff_sees_referral(referral_id));

drop policy if exists reward_claim_staff_read on reward_claim;
create policy reward_claim_staff_read on reward_claim for select to authenticated
  using (app_staff_sees_partner(partner_id));

drop policy if exists reward_claim_admin_write on reward_claim;
create policy reward_claim_admin_write on reward_claim for update to authenticated
  using (app_is_admin()) with check (app_is_admin());

-- Staff need the ladder itself to read a claim against.
drop policy if exists reward_tier_read on reward_tier;
create policy reward_tier_read on reward_tier for select to authenticated
  using (active);

-- ================================================= the order approval gate

-- `referral_order` has NO update policy, for anyone, including admins. The only
-- way an order's approval state changes is this function, and it checks the
-- caller itself. That is deliberate: this single column decides whether a firm
-- is handed a gold coin, and a mistake in app-layer role checking should not be
-- enough to move it.
create or replace function review_referral_order(
  p_order_id uuid,
  p_status   text,
  p_note     text default null
) returns referral_order
language plpgsql security definer set search_path = public as $$
declare v_row referral_order;
begin
  if not app_is_admin() then
    raise exception 'only a Material Depot admin can verify a referred order'
      using errcode = '42501';
  end if;
  if p_status not in ('pending','approved','rejected') then
    raise exception 'status must be pending, approved or rejected';
  end if;

  update referral_order
     set approval_status = p_status,
         review_note     = p_note,
         approved_by     = case when p_status = 'pending' then null else auth.uid() end,
         approved_at     = case when p_status = 'pending' then null else now() end
   where id = p_order_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'no such order';
  end if;
  return v_row;
end $$;
revoke all on function review_referral_order(uuid,text,text) from public;
grant execute on function review_referral_order(uuid,text,text) to authenticated;

-- ============================================== partner_application policies

-- Outreach and inbound managers create and work applications in their market;
-- admins see and decide all of them. A partner has no read at all — the form is
-- an internal record with a meeting note in it.
drop policy if exists partner_application_staff_read on partner_application;
create policy partner_application_staff_read on partner_application for select to authenticated
  using (app_covers_market(market) or created_by = auth.uid());

drop policy if exists partner_application_staff_insert on partner_application;
create policy partner_application_staff_insert on partner_application for insert to authenticated
  with check (app_is_staff() and created_by = auth.uid() and app_covers_market(market));

-- The person who filed it can correct it while it is still waiting. Once an
-- admin has decided, only an admin touches it — an application edited after
-- approval is an approval for something nobody approved.
drop policy if exists partner_application_update on partner_application;
create policy partner_application_update on partner_application for update to authenticated
  using (app_is_admin() or (created_by = auth.uid() and status = 'submitted'))
  with check (app_is_admin() or (created_by = auth.uid() and status = 'submitted'));

-- ================================================ outreach pipeline policies

drop policy if exists outreach_prospect_read on outreach_prospect;
create policy outreach_prospect_read on outreach_prospect for select to authenticated
  using (app_covers_market(market) or owner_id = auth.uid());

drop policy if exists outreach_prospect_write on outreach_prospect;
create policy outreach_prospect_write on outreach_prospect for insert to authenticated
  with check (app_is_staff() and app_covers_market(market));

drop policy if exists outreach_prospect_update on outreach_prospect;
create policy outreach_prospect_update on outreach_prospect for update to authenticated
  using (app_is_admin() or ((app_covers_market(market) or owner_id = auth.uid()) and app_is_staff()))
  with check (app_is_staff());

drop policy if exists outreach_prospect_delete on outreach_prospect;
create policy outreach_prospect_delete on outreach_prospect for delete to authenticated
  using (app_is_admin());

create or replace function app_staff_sees_prospect(pid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from outreach_prospect p
    where p.id = pid and (app_covers_market(p.market) or p.owner_id = auth.uid())
  )
$$;

drop policy if exists outreach_touch_read on outreach_touch;
create policy outreach_touch_read on outreach_touch for select to authenticated
  using (app_staff_sees_prospect(prospect_id));

drop policy if exists outreach_touch_insert on outreach_touch;
create policy outreach_touch_insert on outreach_touch for insert to authenticated
  with check (app_is_staff() and app_staff_sees_prospect(prospect_id) and by_user = auth.uid());

-- ====================================================== portfolio policies

-- The firm owns its own portfolio, up to the point it asks for it to be
-- published. `using` reads the row as it is now, `with check` the row as it
-- would be: together they allow draft → submitted and let a rejected item be
-- reworked, while a PUBLISHED item is frozen and `published` is a status the
-- firm can never write. Only `review_portfolio_item()` sets that.
drop policy if exists portfolio_partner_read on portfolio_item;
create policy portfolio_partner_read on portfolio_item for select to authenticated
  using (partner_id in (select app_partner_ids()) or app_staff_sees_partner(partner_id));

drop policy if exists portfolio_partner_insert on portfolio_item;
create policy portfolio_partner_insert on portfolio_item for insert to authenticated
  with check (app_can_write(partner_id) and status in ('draft','submitted'));

drop policy if exists portfolio_partner_update on portfolio_item;
create policy portfolio_partner_update on portfolio_item for update to authenticated
  using (app_can_write(partner_id) and status in ('draft','rejected'))
  with check (app_can_write(partner_id) and status in ('draft','submitted'));

drop policy if exists portfolio_partner_delete on portfolio_item;
create policy portfolio_partner_delete on portfolio_item for delete to authenticated
  using (app_can_write(partner_id) and status in ('draft','rejected'));

create or replace function review_portfolio_item(
  p_item_id uuid,
  p_status  text,
  p_note    text default null
) returns portfolio_item
language plpgsql security definer set search_path = public as $$
declare v_row portfolio_item;
begin
  if not app_is_admin() then
    raise exception 'only a Material Depot admin can publish or reject a portfolio piece'
      using errcode = '42501';
  end if;
  if p_status not in ('submitted','published','rejected','draft') then
    raise exception 'status must be draft, submitted, published or rejected';
  end if;

  update portfolio_item
     set status      = p_status,
         review_note = p_note,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_item_id
  returning * into v_row;

  if v_row.id is null then raise exception 'no such portfolio item'; end if;
  return v_row;
end $$;
revoke all on function review_portfolio_item(uuid,text,text) from public;
grant execute on function review_portfolio_item(uuid,text,text) to authenticated;

-- ==================================================== activity policies

-- The firm reads what was done with them. Staff write it; a firm never can —
-- "Material Depot approved your order" has to mean Material Depot said so.
drop policy if exists partner_activity_read on partner_activity;
create policy partner_activity_read on partner_activity for select to authenticated
  using (
    (partner_id in (select app_partner_ids()) and visible_to_partner)
    or app_staff_sees_partner(partner_id)
  );

drop policy if exists partner_activity_staff_insert on partner_activity;
create policy partner_activity_staff_insert on partner_activity for insert to authenticated
  with check (app_is_staff() and app_staff_sees_partner(partner_id) and by_user = auth.uid());

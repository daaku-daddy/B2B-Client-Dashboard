-- B2B Client Dashboard — the Studio Sales Dashboard, PRD v1.1
-- Target project: vmwvxwqzqxhwesjokztf  (NOT the CRM project olkkioacgccgsjjlmbhc,
-- NOT the Site Audit project jqrdfnjfxqxrazfkaofm)
--
-- Run AFTER 004_roles_rls.sql. Paste the whole file into Supabase → SQL Editor.
-- Nothing in the repo runs it. Re-running is safe: every statement is
-- if-not-exists, or drops before it creates.
--
-- What this adds, and which section of the PRD asked for it:
--
--   §6.3 / §10.4  the columns the incentive formula cannot be computed without
--                 — per-order coupon code and discount ACTUALLY AVAILED, and a
--                 delivery date to count the 30-day maturation from
--   §9.2          the referral form's real fields, and the client's consent
--   §9.4          escalations, and the thread on them
--   §10           nothing. The slab tables are versioned source in
--                 lib/domain/slabs.ts — see the note there for why config in
--                 Postgres cannot answer "what was the rate in August"
--   §13.3         per-firm theming
--   §13.4         notification preferences
--   §14.5         the log behind a revealed phone number
--   App. B        reason codes, as CHECK constraints rather than free text
--
-- ============================================================================

-- ============================================ §10.4 — what cashback needs

-- Net cashback = (slab rate × spend) − the store discount ALREADY AVAILED on
-- those orders. §10.4 calls the second half a hard Phase 1 dependency and §18
-- says the fallback is gross cashback with explicit sign-off, "never a silent
-- approximation".
--
-- So `discount_availed` is NULLABLE and null means UNKNOWN, not zero. The app
-- reads a null as "we cannot state a net figure for this period" rather than
-- summing it as nothing — `discountOn()` in lib/domain/ledger.ts. Defaulting
-- this column to 0 would overstate every partner's net cashback on the platform
-- and the error would only surface on settlement day.
alter table referral_order add column if not exists coupon_code      text;
alter table referral_order add column if not exists discount_availed numeric(14,2);

-- §6.2: maturation is 30 days after DELIVERY, not after the order. Null means
-- Material Depot has not told us yet; `maturity()` reports `unknown` and the
-- screen says so, rather than counting from `ordered_on` and paying a month
-- early.
alter table referral_order add column if not exists delivered_on date;

-- §6.3.6 — an order on the partner firm's own GSTIN. Counts towards revenue,
-- tagged SELF, and included or excluded per an admin decision on each one.
alter table referral_order add column if not exists is_self boolean not null default false;

-- Appendix B. A rejection with no code is the dispute §18 rates Medium/High;
-- "visible reason codes" is the stated mitigation. Free text is an ADDITION to
-- the code (review_note), never a replacement for it.
alter table referral_order add column if not exists not_counted_reason text;
do $$ begin
  alter table referral_order add constraint referral_order_not_counted_reason_ck
    check (not_counted_reason is null or not_counted_reason in (
      'PRE_GO_LIVE','CLIENT_NOT_ATTRIBUTED','ATTRIBUTION_EXPIRED','EXCLUDED_CATEGORY',
      'SELF_PURCHASE_EXCLUDED','ORDER_CANCELLED','NOT_MATURED','OPEN_ESCALATION',
      'DUPLICATE_ORDER','PRICING_EXCEPTION','OTHER'));
exception when duplicate_object then null;
end $$;

create index if not exists referral_order_ordered_idx on referral_order(ordered_on);

-- ================================== §9.2 / §14.5 — the referral, in full

alter table referral add column if not exists email          text;
alter table referral add column if not exists city           text;
alter table referral add column if not exists locality       text;
alter table referral add column if not exists project_type   text
  check (project_type is null or project_type in ('residential','commercial','other'));
alter table referral add column if not exists budget_band    text;
alter table referral add column if not exists timeline       text;
alter table referral add column if not exists categories     text[] not null default '{}';
alter table referral add column if not exists assigned_user  uuid references auth.users(id) on delete set null;

-- §14.5's consent basis, as THREE states and not a boolean with a default.
--
-- null = we have not asked. false = the client said no. The difference decides
-- what the partner is allowed to see (itemised journey, or aggregate facts
-- only) and also who the KAM should ring, and folding "not asked" into
-- "refused" throws that second signal away. `consent_claimed_at` is the
-- partner ticking the box on the form; `consent_given` is Material Depot having
-- confirmed it with the client, which §14.5 requires separately.
alter table referral add column if not exists consent_claimed_at timestamptz;
alter table referral add column if not exists consent_given      boolean;
alter table referral add column if not exists consent_at         timestamptz;

-- §6.4's referral status machine. `submitted` is the default because §9.2 sends
-- the form straight to a KAM and an Admin with a 48h SLA — there is no draft
-- state in the partner UI.
alter table referral add column if not exists status text not null default 'submitted'
  check (status in ('submitted','under_review','approved','rejected','duplicate','active','dormant','expired'));
alter table referral add column if not exists rejection_reason text
  check (rejection_reason is null or rejection_reason in (
    'ALREADY_ATTRIBUTED','EXISTING_CUSTOMER','INVALID_CONTACT','DUPLICATE_SUBMISSION',
    'NO_CONSENT','OUT_OF_SERVICE_AREA','OTHER'));
alter table referral add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table referral add column if not exists reviewed_at timestamptz;
alter table referral add column if not exists review_note text;
-- §6.3: attribution is valid for a defined window. Null = open-ended, which is
-- what a referral approved before §17 decision 11 is settled gets.
alter table referral add column if not exists attribution_expires_on date;

create index if not exists referral_status_idx on referral(status);

-- The decision fields belong to Material Depot, not to the firm that submitted
-- the form. RLS cannot restrict an update to some columns, so — exactly as
-- `partner_guard_md_fields` does for the firm's own record — a trigger freezes
-- them. Without this, `referral_write` (which a partner needs, to correct a
-- typo in a client's name) would also let them approve their own referral.
create or replace function referral_guard_md_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or app_is_admin() then return new; end if;
  if new.status                 is distinct from old.status
     or new.rejection_reason       is distinct from old.rejection_reason
     or new.consent_given          is distinct from old.consent_given
     or new.consent_at             is distinct from old.consent_at
     or new.reviewed_by            is distinct from old.reviewed_by
     or new.reviewed_at            is distinct from old.reviewed_at
     or new.review_note            is distinct from old.review_note
     or new.attribution_expires_on is distinct from old.attribution_expires_on
     or new.md_phone               is distinct from old.md_phone
  then
    raise exception 'that field is set by Material Depot, not by the firm'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists referral_guard on referral;
create trigger referral_guard before update on referral
  for each row execute function referral_guard_md_fields();

-- The one thing an admin can change about a referral, checked inside Postgres
-- the same way an order approval is. Same reasoning as
-- `review_referral_order()`: this column decides whose client this is, and an
-- app-layer role check is not enough to move it.
create or replace function review_referral(
  p_referral_id uuid,
  p_status      text,
  p_reason      text default null,
  p_note        text default null,
  p_consent     boolean default null
) returns referral
language plpgsql security definer set search_path = public as $$
declare v_row referral;
begin
  if not app_is_admin() then
    raise exception 'only a Material Depot admin can decide a referral'
      using errcode = '42501';
  end if;
  if p_status not in ('submitted','under_review','approved','rejected','duplicate','active','dormant','expired') then
    raise exception 'not a referral status: %', p_status;
  end if;
  if p_status in ('rejected','duplicate') and p_reason is null then
    raise exception 'a rejected referral needs a reason code — PRD Appendix B';
  end if;

  update referral
     set status           = p_status,
         rejection_reason = case when p_status in ('rejected','duplicate') then p_reason else null end,
         review_note      = p_note,
         reviewed_by      = auth.uid(),
         reviewed_at      = now(),
         consent_given    = coalesce(p_consent, consent_given),
         consent_at       = case when p_consent is null then consent_at else now() end
   where id = p_referral_id
  returning * into v_row;

  if v_row.id is null then raise exception 'no such referral'; end if;
  return v_row;
end $$;
revoke all on function review_referral(uuid,text,text,text,boolean) from public;
grant execute on function review_referral(uuid,text,text,text,boolean) to authenticated;

-- §9.2's real-time duplicate check: "never let a partner submit blind and get
-- rejected later."
--
-- Whether ANOTHER firm already holds a number cannot be answered through RLS,
-- and should not be — that is another firm's client list. So this answers
-- exactly one bit, yes or no, and nothing about who. A partner learns that the
-- number is spoken for and takes it to their KAM; they do not learn which of
-- their competitors referred it.
--
-- `stable` and not `volatile` so it can be called on every keystroke of the
-- phone field without a write-path cost.
create or replace function referral_phone_taken(p_phone text)
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from referral
     where md_phone = p_phone
       and partner_id not in (select app_partner_ids())
       and status not in ('rejected','duplicate','expired')
  )
$$;
revoke all on function referral_phone_taken(text) from public;
grant execute on function referral_phone_taken(text) to authenticated;

-- ====================================== §9.4 — escalations, and the thread

-- Raised by a partner against a referred client or one of their orders. Routes
-- to the KAM; §9.4 auto-escalates to Admin if unacknowledged in 24h.
--
-- This table is the one reason `referral_order` maturation can be held open
-- (§10.5), so it is read by the money path and not only by a support screen.
create table if not exists escalation (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references partner(id) on delete cascade,
  referral_id  uuid references referral(id) on delete set null,
  order_id     uuid references referral_order(id) on delete set null,
  category     text not null
                 check (category in ('delivery_delay','quality_damage','wrong_item','billing_gst','other')),
  subject      text not null,
  description  text not null,
  -- §9.4: images or PDF, ≤10MB each, max 5. Stored as URLs; nothing uploads to
  -- Supabase Storage from this app yet, so this is the contract and not yet a
  -- working attach button — `docs/escalations.md` says so rather than the UI
  -- pretending.
  attachments  text[] not null default '{}',
  status       text not null default 'open'
                 check (status in ('open','acknowledged','in_progress','resolved','closed','reopened')),
  raised_by    uuid references auth.users(id) on delete set null,
  raised_at    timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at     timestamptz,
  closed_at       timestamptz,
  -- §9.4's SLA display: the target, so the partner sees the promise and not
  -- only the elapsed time.
  ack_due_at      timestamptz not null default now() + interval '24 hours',
  resolution_note text,
  assigned_to  uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists escalation_partner_idx on escalation(partner_id, raised_at desc);
create index if not exists escalation_order_idx on escalation(order_id);
create index if not exists escalation_open_idx on escalation(status) where status in ('open','acknowledged','in_progress','reopened');

-- §9.4: "Threaded comments visible to partner; internal notes hidden." The
-- hiding is a POLICY, not a filter in a query — a `where internal = false` in
-- the app is one forgotten call away from showing a KAM's private note to the
-- firm it is about.
create table if not exists escalation_comment (
  id            uuid primary key default gen_random_uuid(),
  escalation_id uuid not null references escalation(id) on delete cascade,
  body          text not null,
  internal      boolean not null default false,
  author_id     uuid references auth.users(id) on delete set null,
  author_side   text not null default 'partner' check (author_side in ('partner','md')),
  created_at    timestamptz not null default now()
);
create index if not exists escalation_comment_idx on escalation_comment(escalation_id, created_at);

-- ============================ §13.3 / §13.4 — theme and notifications

-- "The workspace should feel like the partner's own brand." Six presets plus a
-- custom pair of colours. Stored per parent org and applied to every user of
-- it, with a per-user override back to default (§13.3) held client-side.
--
-- §13.3's constraints are enforced in the app, not here: WCAG AA contrast is
-- checked before save, and status colours for success, warning and error are
-- not themeable at all — a theme that makes a destructive action ambiguous is
-- worse than no theme.
alter table partner add column if not exists theme_preset  text not null default 'default';
alter table partner add column if not exists theme_primary text;
alter table partner add column if not exists theme_accent  text;
alter table partner add column if not exists theme_base    text not null default 'light'
  check (theme_base in ('light','dark'));

-- §13.1's remaining profile fields, and the two §2.5 needs so that pincode-based
-- KAM assignment in Phase 2 is a configuration change rather than a rebuild.
alter table partner add column if not exists legal_name        text;
alter table partner add column if not exists pan               text;
alter table partner add column if not exists registered_address text;
alter table partner add column if not exists office_address    text;
alter table partner add column if not exists pincode           text check (pincode is null or pincode ~ '^[1-9][0-9]{5}$');
alter table partner add column if not exists operating_area    text;
alter table partner add column if not exists linkedin          text;
alter table partner add column if not exists established_year  int;
alter table partner add column if not exists team_size         text;
alter table partner add column if not exists services          text[] not null default '{}';
alter table partner add column if not exists project_types     text[] not null default '{}';
alter table partner add column if not exists budget_range      text;
-- §11.7: aggregated market-signal use is disclosed in the Terms with an
-- org-level opt-out. Default true because the disclosure is at the point of
-- upload and in the Terms; the switch is in Settings.
alter table partner add column if not exists market_signal_opt_in boolean not null default true;

-- §13.4 — per-channel toggles per event class. One row per firm; the app reads
-- a missing row as "everything on", because a firm that has never opened
-- Settings should still be told their cashback was confirmed.
create table if not exists notification_pref (
  partner_id  uuid primary key references partner(id) on delete cascade,
  -- event class → { in_app, email, whatsapp }. Transactional and legal notices
  -- are non-optional (§13.4) and are not represented here at all, which is how
  -- they stay non-optional.
  prefs       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ================================= §14.5 — the log behind a revealed phone

-- "Display as 98XXXXXX21 by default with a reveal action that is LOGGED."
-- The log is the reason the mask is a control and not decoration: a partner who
-- knows a reveal is recorded reveals the client they are about to ring, and not
-- the whole list.
create table if not exists phone_reveal (
  id          uuid primary key default gen_random_uuid(),
  partner_id  uuid not null references partner(id) on delete cascade,
  referral_id uuid not null references referral(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  revealed_at timestamptz not null default now(),
  surface     text
);
create index if not exists phone_reveal_partner_idx on phone_reveal(partner_id, revealed_at desc);

-- ============================================================= policies

do $$
declare t text;
begin
  foreach t in array array['escalation','escalation_comment','notification_pref','phone_reveal'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- A firm raises, reads and comments on its own escalations. It does not get to
-- move the status — acknowledging and resolving is Material Depot's side of the
-- SLA, and a partner who could mark their own ticket resolved would break the
-- one thing that holds an order's maturation open.
drop policy if exists escalation_read on escalation;
create policy escalation_read on escalation for select to authenticated
  using (partner_id in (select app_partner_ids()) or app_staff_sees_partner(partner_id));

drop policy if exists escalation_insert on escalation;
create policy escalation_insert on escalation for insert to authenticated
  with check (partner_id in (select app_partner_ids()) or app_staff_sees_partner(partner_id));

-- Staff only, and the function below is what a partner's "reopen" goes through.
drop policy if exists escalation_staff_update on escalation;
create policy escalation_staff_update on escalation for update to authenticated
  using (app_staff_sees_partner(partner_id)) with check (app_staff_sees_partner(partner_id));

-- The internal-note split. Two policies, not one with an OR, so that the
-- partner-side rule can be read on its own and checked: a partner sees
-- `internal = false` and nothing else, whoever wrote it.
drop policy if exists escalation_comment_partner_read on escalation_comment;
create policy escalation_comment_partner_read on escalation_comment for select to authenticated
  using (
    not internal
    and exists (select 1 from escalation e
                 where e.id = escalation_id and e.partner_id in (select app_partner_ids()))
  );

drop policy if exists escalation_comment_staff_read on escalation_comment;
create policy escalation_comment_staff_read on escalation_comment for select to authenticated
  using (exists (select 1 from escalation e where e.id = escalation_id and app_staff_sees_partner(e.partner_id)));

-- A partner can only write a NON-internal comment. `with check (not internal)`
-- is the whole of that rule and it is in the database, so a missing flag in a
-- form cannot produce a partner-authored "internal" note that staff would read
-- as one of their own.
drop policy if exists escalation_comment_partner_write on escalation_comment;
create policy escalation_comment_partner_write on escalation_comment for insert to authenticated
  with check (
    not internal
    and author_side = 'partner'
    and exists (select 1 from escalation e
                 where e.id = escalation_id and e.partner_id in (select app_partner_ids()))
  );

drop policy if exists escalation_comment_staff_write on escalation_comment;
create policy escalation_comment_staff_write on escalation_comment for insert to authenticated
  with check (exists (select 1 from escalation e where e.id = escalation_id and app_staff_sees_partner(e.partner_id)));

drop policy if exists notification_pref_all on notification_pref;
create policy notification_pref_all on notification_pref for all to authenticated
  using (partner_id in (select app_partner_ids())) with check (partner_id in (select app_partner_ids()));

-- A firm writes its own reveal log and cannot read it back or delete it. An
-- audit record the audited party can edit is not one.
drop policy if exists phone_reveal_insert on phone_reveal;
create policy phone_reveal_insert on phone_reveal for insert to authenticated
  with check (partner_id in (select app_partner_ids()));

drop policy if exists phone_reveal_staff_read on phone_reveal;
create policy phone_reveal_staff_read on phone_reveal for select to authenticated
  using (app_staff_sees_partner(partner_id));

-- ================================ the order approval gate, with a reason

-- Replaces the three-argument version from 004. Same guarantee — `app_is_admin()`
-- re-checked inside Postgres, `referral_order` still has no UPDATE policy for
-- anybody — with Appendix B's reason code, which a decline now requires.
--
-- The old signature is dropped rather than left beside it: two functions that
-- both approve an order, one of which does not need a reason, is a gate with a
-- hole in it.
drop function if exists review_referral_order(uuid, text, text);

create or replace function review_referral_order(
  p_order_id uuid,
  p_status   text,
  p_note     text default null,
  p_reason   text default null,
  p_self     boolean default null
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
  if p_status = 'rejected' and p_reason is null then
    raise exception 'a declined order needs a reason code — PRD Appendix B';
  end if;

  update referral_order
     set approval_status     = p_status,
         review_note         = p_note,
         not_counted_reason  = case when p_status = 'rejected' then p_reason else null end,
         is_self             = coalesce(p_self, is_self),
         approved_by         = case when p_status = 'pending' then null else auth.uid() end,
         approved_at         = case when p_status = 'pending' then null else now() end
   where id = p_order_id
  returning * into v_row;

  if v_row.id is null then raise exception 'no such order'; end if;
  return v_row;
end $$;
revoke all on function review_referral_order(uuid,text,text,text,boolean) from public;
grant execute on function review_referral_order(uuid,text,text,text,boolean) to authenticated;

-- Acknowledge / progress / resolve an escalation. Staff-side, and it stamps the
-- SLA timestamps rather than trusting a form to send them.
create or replace function set_escalation_status(
  p_id     uuid,
  p_status text,
  p_note   text default null
) returns escalation
language plpgsql security definer set search_path = public as $$
declare v_row escalation;
begin
  if not app_is_staff() then
    raise exception 'only Material Depot can move an escalation' using errcode = '42501';
  end if;
  if p_status not in ('open','acknowledged','in_progress','resolved','closed','reopened') then
    raise exception 'not an escalation status: %', p_status;
  end if;

  update escalation
     set status          = p_status,
         assigned_to     = coalesce(assigned_to, auth.uid()),
         acknowledged_at = case when p_status = 'acknowledged' and acknowledged_at is null then now() else acknowledged_at end,
         resolved_at     = case when p_status = 'resolved' then now() when p_status = 'reopened' then null else resolved_at end,
         closed_at       = case when p_status = 'closed' then now() else closed_at end,
         resolution_note = coalesce(p_note, resolution_note),
         updated_at      = now()
   where id = p_id and app_staff_sees_partner(partner_id)
  returning * into v_row;

  if v_row.id is null then raise exception 'no such escalation, or not yours'; end if;
  return v_row;
end $$;
revoke all on function set_escalation_status(uuid,text,text) from public;
grant execute on function set_escalation_status(uuid,text,text) to authenticated;

-- §9.4: "On resolution, partner can accept or reopen once." Reopening is the
-- partner's, and it is the only status move they get.
create or replace function reopen_escalation(p_id uuid, p_why text)
returns escalation
language plpgsql security definer set search_path = public as $$
declare v_row escalation;
begin
  update escalation
     set status = 'reopened', resolved_at = null, updated_at = now()
   where id = p_id
     and partner_id in (select app_partner_ids())
     and status in ('resolved','closed')
  returning * into v_row;

  if v_row.id is null then
    raise exception 'that escalation is not yours, or is not resolved' using errcode = '42501';
  end if;

  insert into escalation_comment (escalation_id, body, internal, author_id, author_side)
  values (p_id, p_why, false, auth.uid(), 'partner');
  return v_row;
end $$;
revoke all on function reopen_escalation(uuid,text) from public;
grant execute on function reopen_escalation(uuid,text) to authenticated;

-- ------------------------------------------------------------ keep-warm

do $$
declare t text;
begin
  foreach t in array array['escalation','notification_pref'] loop
    execute format(
      'drop trigger if exists %I_touch on %I; create trigger %I_touch before update on %I for each row execute function touch_updated_at()',
      t, t, t, t);
  end loop;
end $$;

-- ============================================================================
-- Sanity check — run this after. Every count should be a number, not an error.
-- ============================================================================
select
  (select count(*) from information_schema.columns
    where table_name = 'referral_order'
      and column_name in ('coupon_code','discount_availed','delivered_on','not_counted_reason','is_self')) as order_columns_added,
  (select count(*) from information_schema.columns
    where table_name = 'referral'
      and column_name in ('consent_given','status','rejection_reason','categories')) as referral_columns_added,
  (select count(*) from escalation)         as escalations,
  (select count(*) from notification_pref)  as notification_prefs,
  (select count(*) from phone_reveal)       as phone_reveals;

-- B2B Client Dashboard — staff roles, partner lifecycle, order approval,
-- outreach onboarding, and partner portfolios.
-- Target project: vmwvxwqzqxhwesjokztf. Run AFTER 002_rls.sql.
--
-- Idempotent, like the other two: every object is created if-not-exists and
-- every policy is dropped before it is created, so re-running this file is the
-- intended way to apply a change to it.
--
-- What this file adds, in one sentence each:
--
--   1. `staff_user` — Material Depot's own people. Three jobs: admin (verifies),
--      KAM / outreach / inbound (the B2B team). Scoped by MARKET, so the
--      Bangalore outreach manager does not work the Hyderabad list.
--   2. An APPROVAL GATE on `referral_order`. An order counts towards a
--      partner's rewards only once an admin has verified it.
--   3. `partner_application` — the form an outreach manager fills after a
--      meeting, which an admin verifies before a login is issued.
--   4. `outreach_prospect` / `outreach_touch` — the list an outreach manager
--      works, and every call, message and meeting on it.
--   5. `portfolio_item` — the work a partner submits for Material Depot's
--      public site, published only after an admin reviews it.
--   6. `partner_activity` — what Material Depot has done with this firm,
--      readable by the firm itself.
--
-- THE TRUST BOUNDARY THIS FILE DOES NOT CROSS: no policy here lets staff read
-- `client`, `project`, `project_area`, `board`, `board_item`, `quote`,
-- `quote_line`, `procurement_item` or `finance_entry`. An architect's own
-- clients, quotes and margins stay invisible to Material Depot. That is the
-- whole reason a designer would put their work in here, and a "just for
-- support" read policy on any of those tables would throw it away.
-- `supabase/test/rlstest.js` asserts it table by table.

-- ============================================================ 1. staff users

-- `market` is free text validated against the registry in lib/domain/markets.ts
-- — same pattern as project_area.area_type. Opening a third city must not need
-- a migration nobody runs. NULL market = every market, which is what an admin
-- and the central team have.
create table if not exists staff_user (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  email      text,
  phone      text,
  role       text not null check (role in ('admin','kam','outreach','inbound')),
  market     text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists staff_user_role_idx on staff_user(role) where active;

-- SECURITY DEFINER for the same reason app_partner_ids() is: a policy on
-- staff_user that selects staff_user recurses.
create or replace function app_staff_role()
returns text language sql security definer set search_path = public stable as $$
  select role from staff_user where user_id = auth.uid() and active
$$;

create or replace function app_staff_market()
returns text language sql security definer set search_path = public stable as $$
  select market from staff_user where user_id = auth.uid() and active
$$;

create or replace function app_is_staff()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from staff_user where user_id = auth.uid() and active)
$$;

create or replace function app_is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from staff_user where user_id = auth.uid() and active and role = 'admin')
$$;

-- Does the caller's market cover this row's market?
--
-- An admin, or any staff member with no market set, covers everything. A row
-- with no market yet is visible to everyone on the team rather than to nobody —
-- an unassigned firm that nobody can see is a firm nobody follows up.
create or replace function app_covers_market(m text)
returns boolean language sql security definer set search_path = public stable as $$
  select app_is_staff() and (
    app_is_admin()
    or app_staff_market() is null
    or m is null
    or lower(m) = lower(app_staff_market())
  )
$$;

-- ==================================================== 2. partner lifecycle

alter table partner add column if not exists market            text;
alter table partner add column if not exists kam_user_id       uuid references auth.users(id) on delete set null;
alter table partner add column if not exists onboarding_source text not null default 'self_signup';
alter table partner add column if not exists onboarded_by      uuid references auth.users(id) on delete set null;
-- The CRM's client row for this firm, when the bridge links them. EXACT id, set
-- by the sync; never name-matched. See materialdepot-crm/docs/b2b/partner-bridge.md.
alter table partner add column if not exists md_client_id      text;
-- The full project workspace — rooms, boards, quotes, procurement, P&L — is OFF
-- by default. A designer will not move their pricing into a supplier's portal on
-- day one, and a nav full of modules they have not asked for is what makes them
-- close the tab. Material Depot turns it on per firm, when the firm asks.
alter table partner add column if not exists workspace_enabled boolean not null default false;
-- Public studio profile, for materialdepot.com. Published only via portfolio review.
alter table partner add column if not exists bio        text;
alter table partner add column if not exists website    text;
alter table partner add column if not exists instagram  text;
alter table partner add column if not exists logo_url   text;
alter table partner add column if not exists internal_note text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'partner_onboarding_source_chk') then
    alter table partner add constraint partner_onboarding_source_chk
      check (onboarding_source in ('self_signup','outreach','inbound','existing_client'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'partner_md_client_id_key') then
    alter table partner add constraint partner_md_client_id_key unique (md_client_id);
  end if;
end $$;

create index if not exists partner_market_idx on partner(market);
create index if not exists partner_kam_idx on partner(kam_user_id);

-- Firms that existed before this file ran are self-signups, which is true: the
-- app had no other way in.
update partner set market = case
    when market is not null then market
    when city is null then null
    when lower(city) like 'beng%' or lower(city) like 'bang%' then 'bangalore'
    when lower(city) like 'hyd%' or lower(city) like 'secund%' then 'hyderabad'
    else null
  end
where market is null;

-- Defined here, not beside the other helpers above, because its body reads
-- `partner.market` and `partner.kam_user_id` — a SQL-language function body is
-- parsed when it is created, so it cannot exist before the columns do.
create or replace function app_staff_sees_partner(pid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from partner p
    where p.id = pid
      and (app_covers_market(p.market) or p.kam_user_id = auth.uid())
  )
$$;

-- ================================================ 3. referral order approval

-- An order placed by a referred client does NOT count towards the partner's
-- reward ladder until a Material Depot admin has verified that it is real and
-- that it belongs to this partner. Money is handed over on the strength of this
-- number, so it gets a human.
--
-- The backfill runs ONLY on first application. This file is meant to be re-run,
-- and a second run must not silently re-approve orders an admin has rejected.
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'referral_order' and column_name = 'approval_status'
  ) then
    alter table referral_order add column approval_status text not null default 'pending';
    -- Orders that predate the gate were already counted towards every partner's
    -- progress. Zeroing everyone's earned total is not a migration's job.
    update referral_order set approval_status = 'approved';
  end if;
end $$;

alter table referral_order add column if not exists approved_by  uuid references auth.users(id) on delete set null;
alter table referral_order add column if not exists approved_at  timestamptz;
alter table referral_order add column if not exists review_note  text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'referral_order_approval_chk') then
    alter table referral_order add constraint referral_order_approval_chk
      check (approval_status in ('pending','approved','rejected'));
  end if;
end $$;

create index if not exists referral_order_approval_idx on referral_order(approval_status);

-- ================================================== 4. partner applications

-- The form an outreach manager fills after a meeting. An admin verifies it, and
-- only then is a login created. `status` walks one way:
--   submitted → approved → provisioned
--             ↘ rejected
create table if not exists partner_application (
  id            uuid primary key default gen_random_uuid(),
  firm_name     text not null,
  contact_name  text not null,
  phone         text not null check (phone ~ '^[6-9][0-9]{9}$'),
  email         text not null,
  city          text,
  market        text,
  firm_type     text not null default 'architect'
                  check (firm_type in ('architect','interior_designer','design_build','contractor','other')),
  gst           text,
  team_size     text,
  typical_projects text,
  met_on        date,
  meeting_notes text,
  source        text not null default 'outreach'
                  check (source in ('outreach','inbound','walk_in','partner_referral','existing_client','other')),
  proposed_kam  uuid references auth.users(id) on delete set null,
  status        text not null default 'submitted'
                  check (status in ('submitted','approved','rejected','provisioned')),
  reviewed_by   uuid references auth.users(id) on delete set null,
  reviewed_at   timestamptz,
  review_note   text,
  partner_id    uuid references partner(id) on delete set null,
  credentials_issued_at timestamptz,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- One live application per phone. Two outreach managers working the same firm
-- must collide loudly here rather than produce two logins for one studio.
-- Rejected ones are excluded so a firm that said no in March can be re-applied
-- for in September.
create unique index if not exists partner_application_live_phone_idx
  on partner_application(phone) where status <> 'rejected';
create index if not exists partner_application_status_idx on partner_application(status);
create index if not exists partner_application_market_idx on partner_application(market);

-- ======================================================= 5. outreach pipeline

create table if not exists outreach_prospect (
  id           uuid primary key default gen_random_uuid(),
  firm_name    text not null,
  contact_name text,
  phone        text check (phone is null or phone ~ '^[6-9][0-9]{9}$'),
  email        text,
  city         text,
  market       text not null,
  firm_type    text,
  source       text,
  stage        text not null default 'to_contact'
                 check (stage in ('to_contact','contacted','meeting_set','met','onboarding','onboarded','not_interested')),
  owner_id     uuid references auth.users(id) on delete set null,
  next_action_on date,
  notes        text,
  application_id uuid references partner_application(id) on delete set null,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists outreach_prospect_market_idx on outreach_prospect(market, stage);
create index if not exists outreach_prospect_owner_idx on outreach_prospect(owner_id);

create table if not exists outreach_touch (
  id          uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references outreach_prospect(id) on delete cascade,
  kind        text not null default 'note'
                check (kind in ('call','whatsapp','email','meeting','visit','note')),
  occurred_at timestamptz not null default now(),
  outcome     text,
  note        text,
  by_user     uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists outreach_touch_prospect_idx on outreach_touch(prospect_id, occurred_at desc);

-- ========================================================== 6. portfolios

-- Work a partner submits for Material Depot's public site. `status` is the
-- review gate: a partner can move draft → submitted and can edit a rejected
-- item, but only an admin can set `published`, and a published item is frozen.
-- Nothing here goes on materialdepot.com until a person has looked at it.
create table if not exists portfolio_item (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references partner(id) on delete cascade,
  title        text not null,
  summary      text,
  project_type text,
  city         text,
  completed_on date,
  area_sqft    numeric(12,2),
  cover_url    text,
  image_urls   jsonb not null default '[]'::jsonb,
  credits      text,
  status       text not null default 'draft'
                 check (status in ('draft','submitted','published','rejected')),
  submitted_at timestamptz,
  reviewed_by  uuid references auth.users(id) on delete set null,
  reviewed_at  timestamptz,
  review_note  text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists portfolio_partner_idx on portfolio_item(partner_id);
create index if not exists portfolio_status_idx on portfolio_item(status);

-- ==================================================== 7. partner activity

-- What Material Depot has done with this firm: onboarded them, issued a login,
-- assigned a KAM, approved an order, published their work, called to reactivate
-- them. The partner reads their own rows — "the activity of that partner must be
-- visible to the partner" — except the ones staff mark internal.
create table if not exists partner_activity (
  id          uuid primary key default gen_random_uuid(),
  partner_id  uuid not null references partner(id) on delete cascade,
  kind        text not null,
  title       text not null,
  detail      text,
  occurred_at timestamptz not null default now(),
  visible_to_partner boolean not null default true,
  by_user     uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists partner_activity_partner_idx on partner_activity(partner_id, occurred_at desc);

-- ====================================================== 8. keep updated_at

do $$
declare t text;
begin
  foreach t in array array['partner_application','outreach_prospect','portfolio_item']
  loop
    execute format(
      'drop trigger if exists %I_touch on %I; create trigger %I_touch before update on %I for each row execute function touch_updated_at()',
      t, t, t, t);
  end loop;
end $$;

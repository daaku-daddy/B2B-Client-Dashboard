-- B2B Client Dashboard — initial schema
-- Target project: vmwvxwqzqxhwesjokztf  (NOT the CRM project olkkioacgccgsjjlmbhc,
-- NOT the Site Audit project jqrdfnjfxqxrazfkaofm)
--
-- Paste this whole file into Supabase → SQL Editor → Run. Nothing in the repo
-- runs it. Re-running is safe: every object is created if-not-exists.
--
-- RLS IS ON EVERYWHERE, deliberately. This app is different from Material
-- Depot's field apps: an architect's client list, prices and margins must not
-- be readable by another architect, and the anon key ships to the browser.
-- Do not "fix" a read that returns nothing by turning RLS off.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- partners

-- One row per architect / design firm. `phone` is the EXACT key that ties this
-- partner to Material Depot's own systems (referrals, orders). Ten digits, no
-- country code, no spaces — normalised on write by the app, and unique.
create table if not exists partner (
  id            uuid primary key default gen_random_uuid(),
  firm_name     text not null,
  contact_name  text not null,
  phone         text not null unique check (phone ~ '^[6-9][0-9]{9}$'),
  email         text,
  city          text,
  gst           text,
  firm_type     text not null default 'architect'
                  check (firm_type in ('architect','interior_designer','design_build','contractor','other')),
  onboarded_on  date not null default current_date,
  created_at    timestamptz not null default now()
);

-- auth.users → partner. A firm can have several logins (principal + juniors).
create table if not exists partner_user (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  partner_id uuid not null references partner(id) on delete cascade,
  role       text not null default 'principal' check (role in ('principal','associate','viewer')),
  created_at timestamptz not null default now()
);
create index if not exists partner_user_partner_idx on partner_user(partner_id);

-- Read partner_user WITHOUT tripping RLS recursion. Every policy below goes
-- through this instead of selecting partner_user directly.
create or replace function app_partner_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$ select partner_id from partner_user where user_id = auth.uid() $$;

create or replace function app_is_member(pid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$ select exists (
  select 1 from partner_user where user_id = auth.uid() and partner_id = pid
) $$;

create or replace function app_can_write(pid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$ select exists (
  select 1 from partner_user
  where user_id = auth.uid() and partner_id = pid and role in ('principal','associate')
) $$;

-- ----------------------------------------------------------------- clients

create table if not exists client (
  id          uuid primary key default gen_random_uuid(),
  partner_id  uuid not null references partner(id) on delete cascade,
  name        text not null,
  phone       text check (phone is null or phone ~ '^[6-9][0-9]{9}$'),
  email       text,
  city        text,
  address     text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists client_partner_idx on client(partner_id);

-- ---------------------------------------------------------------- projects

create table if not exists project (
  id            uuid primary key default gen_random_uuid(),
  partner_id    uuid not null references partner(id) on delete cascade,
  client_id     uuid not null references client(id) on delete cascade,
  name          text not null,
  site_address  text,
  city          text,
  project_type  text not null default 'residential'
                  check (project_type in ('residential','commercial','hospitality','retail','office','other')),
  -- The three stages from the brief. A project sits in exactly one.
  stage         text not null default 'design'
                  check (stage in ('design','procurement','execution','closed')),
  status        text not null default 'active'
                  check (status in ('active','on_hold','won','lost','closed')),
  carpet_area_sqft numeric(12,2),
  budget        numeric(14,2),
  design_fee    numeric(14,2),
  started_on    date,
  target_on     date,
  closed_on     date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists project_partner_idx on project(partner_id);
create index if not exists project_client_idx on project(client_id);

-- Areas of the house. `area_type` is free text validated against the registry
-- in lib/domain/areas.ts (same taxonomy palette.materialdepot.com uses) — no
-- CHECK here, so adding an area type never needs a migration nobody runs.
create table if not exists project_area (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references project(id) on delete cascade,
  area_type      text not null,
  name           text not null,
  floor_area_sqft numeric(12,2),
  wall_area_sqft  numeric(12,2),
  status         text not null default 'exploring'
                   check (status in ('exploring','shortlisted','finalised','dropped')),
  sort_order     int not null default 0,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists project_area_project_idx on project_area(project_id);

-- ------------------------------------------------------------------ boards

-- A design option for one area. Several boards per area is the point: the
-- architect shows the client three, the client picks one.
create table if not exists board (
  id           uuid primary key default gen_random_uuid(),
  area_id      uuid not null references project_area(id) on delete cascade,
  name         text not null,
  -- Deep link back into palette: ?scene=<slug>
  palette_scene text,
  cover_url    text,
  status       text not null default 'draft'
                 check (status in ('draft','shared','approved','rejected')),
  approved_at  timestamptz,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists board_area_idx on board(area_id);

-- One product (or reference image, or note) on a board.
--
-- The product columns are a SNAPSHOT taken when the architect picked it, not a
-- live lookup. A quote must not silently reprice itself between being shared
-- and being accepted; `priced_at` says when the snapshot was taken and the UI
-- offers a re-price against today's catalogue.
create table if not exists board_item (
  id           uuid primary key default gen_random_uuid(),
  board_id     uuid not null references board(id) on delete cascade,
  kind         text not null default 'product' check (kind in ('product','image','note')),
  -- where it goes: floor / lower_wall / upper_wall / ceiling / countertop / …
  surface      text,
  -- catalogue snapshot
  variant_id   text,
  sku          text,
  product_name text,
  brand        text,
  category     text,
  size         text,
  finish       text,
  image_url    text,
  md_url       text,
  unit         text,                       -- the unit the rate is quoted in
  rate         numeric(14,2),              -- selling price incl. tax, per unit
  mrp          numeric(14,2),
  gst_pct      numeric(5,2),
  coverage_area numeric(12,3),             -- sqft per box, when the unit is a box
  priced_at    timestamptz,
  -- quantity the architect wants here
  qty          numeric(14,3),
  wastage_pct  numeric(5,2) not null default 0,
  note         text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists board_item_board_idx on board_item(board_id);

-- ------------------------------------------------------------------ quotes

create table if not exists quote (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references project(id) on delete cascade,
  version      int not null default 1,
  title        text,
  status       text not null default 'draft'
                 check (status in ('draft','shared','accepted','rejected','superseded')),
  -- The architect's own markup, applied on top of MD rates. Per quote, so a
  -- line can still override it.
  markup_pct   numeric(5,2) not null default 0,
  discount     numeric(14,2) not null default 0,
  valid_until  date,
  shared_at    timestamptz,
  decided_at   timestamptz,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (project_id, version)
);
create index if not exists quote_project_idx on quote(project_id);

-- Lines are snapshots too, for the same reason board items are. `board_item_id`
-- is kept for traceability but is ON DELETE SET NULL: deleting a board must
-- never silently empty a quote that was already shared with a client.
create table if not exists quote_line (
  id            uuid primary key default gen_random_uuid(),
  quote_id      uuid not null references quote(id) on delete cascade,
  board_item_id uuid references board_item(id) on delete set null,
  area_id       uuid references project_area(id) on delete set null,
  area_label    text,
  description   text not null,
  sku           text,
  variant_id    text,
  qty           numeric(14,3) not null default 0,
  unit          text not null,
  rate          numeric(14,2) not null default 0,   -- MD rate, incl. tax
  gst_pct       numeric(5,2) not null default 0,
  line_markup_pct numeric(5,2),                     -- null = use the quote's
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists quote_line_quote_idx on quote_line(quote_id);

-- ------------------------------------------------------------- procurement

create table if not exists procurement_item (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references project(id) on delete cascade,
  quote_line_id uuid references quote_line(id) on delete set null,
  area_id       uuid references project_area(id) on delete set null,
  area_label    text,
  description   text not null,
  sku           text,
  variant_id    text,
  unit          text not null,
  qty_required  numeric(14,3) not null default 0,
  qty_ordered   numeric(14,3) not null default 0,
  qty_delivered numeric(14,3) not null default 0,
  qty_installed numeric(14,3) not null default 0,
  rate          numeric(14,2) not null default 0,
  status        text not null default 'pending'
                  check (status in ('pending','ordered','dispatched','delivered','installed','cancelled')),
  supplier      text not null default 'Material Depot',
  md_enq_id     text,          -- the Material Depot enquiry / order id, exact
  expected_on   date,
  delivered_on  date,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists procurement_project_idx on procurement_item(project_id);

-- ----------------------------------------------------------------- finance

create table if not exists finance_entry (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references project(id) on delete cascade,
  direction   text not null check (direction in ('cost','income')),
  category    text not null,     -- material / labour / design_fee / transport / …
  description text not null,
  amount      numeric(14,2) not null,
  entry_date  date not null default current_date,
  settled     boolean not null default false,
  counterparty text,
  reference   text,
  created_at  timestamptz not null default now()
);
create index if not exists finance_project_idx on finance_entry(project_id);

-- --------------------------------------------------------------- referrals

-- A client the partner sent to Material Depot. `md_phone` is the exact join key
-- to MD's systems; a referral with no phone can never be matched to an order,
-- so the app refuses to create one.
create table if not exists referral (
  id          uuid primary key default gen_random_uuid(),
  partner_id  uuid not null references partner(id) on delete cascade,
  client_id   uuid references client(id) on delete set null,
  project_id  uuid references project(id) on delete set null,
  client_name text not null,
  md_phone    text not null check (md_phone ~ '^[6-9][0-9]{9}$'),
  referred_on date not null default current_date,
  notes       text,
  created_at  timestamptz not null default now(),
  unique (partner_id, md_phone)
);
create index if not exists referral_partner_idx on referral(partner_id);
create index if not exists referral_phone_idx on referral(md_phone);

-- Everything MD's systems know that this client did. Written ONLY by
-- /api/sync/referrals with the service-role key; partners can read, never write.
--
-- `external_id` is the dedupe key and it is UNIQUE for a reason: Material
-- Depot's field apps log the same event several times (one store arrival has
-- been seen logged twenty times). Without this, "visited 20 times" would be a
-- number an architect reads and believes.
create table if not exists referral_event (
  id           uuid primary key default gen_random_uuid(),
  referral_id  uuid not null references referral(id) on delete cascade,
  event_type   text not null
                 check (event_type in ('store_visit','product_view','cart_add','quote_shared','order_placed','call','other')),
  occurred_at  timestamptz not null,
  store        text,
  title        text,
  detail       text,
  amount       numeric(14,2),
  payload      jsonb not null default '{}'::jsonb,
  external_id  text not null unique,
  synced_at    timestamptz not null default now()
);
create index if not exists referral_event_referral_idx on referral_event(referral_id, occurred_at desc);

-- Orders the referred client actually placed. One row per MD enquiry id, which
-- is what makes the incentive total idempotent under re-sync.
create table if not exists referral_order (
  id          uuid primary key default gen_random_uuid(),
  referral_id uuid not null references referral(id) on delete cascade,
  md_enq_id   text not null unique,
  order_value numeric(14,2) not null default 0,
  ordered_on  date,
  store       text,
  status      text,
  synced_at   timestamptz not null default now()
);
create index if not exists referral_order_referral_idx on referral_order(referral_id);

-- ----------------------------------------------------------------- rewards

-- The six tiers from the incentive structure. Config, not code, so the scheme
-- can change without a deploy. Seeded below.
create table if not exists reward_tier (
  id          int primary key,
  threshold   numeric(14,2) not null,
  label       text not null,
  kind        text not null check (kind in ('silver','gold','trip')),
  detail      text,
  active      boolean not null default true
);

insert into reward_tier (id, threshold, label, kind, detail) values
  (1,  100000.00, '10 GM Silver Coin',        'silver', '10 gram silver coin'),
  (2,  200000.00, '30 GM Silver Coin',        'silver', '30 gram silver coin'),
  (3,  500000.00, '1 GM 24K Gold Coin',       'gold',   '1 gram 24 karat gold coin'),
  (4, 1000000.00, '3 GM 24K Gold Coin',       'gold',   '3 gram 24 karat gold coin'),
  (5, 2500000.00, 'Thailand Trip for 2',      'trip',   'Thailand trip for two people'),
  (6, 5000000.00, 'Europe Trip for 2',        'trip',   'Europe trip for two people')
on conflict (id) do update
  set threshold = excluded.threshold,
      label     = excluded.label,
      kind      = excluded.kind,
      detail    = excluded.detail;

-- Whether a tier has been HANDED OVER. Whether it is unlocked is derived from
-- referral_order and never stored — a stored total goes stale the moment an
-- order syncs, and two disagreeing numbers is worse than one slow one.
create table if not exists reward_claim (
  id          uuid primary key default gen_random_uuid(),
  partner_id  uuid not null references partner(id) on delete cascade,
  tier_id     int not null references reward_tier(id),
  status      text not null default 'unlocked'
                check (status in ('unlocked','claimed','fulfilled')),
  unlocked_at timestamptz not null default now(),
  fulfilled_on date,
  notes       text,
  unique (partner_id, tier_id)
);
create index if not exists reward_claim_partner_idx on reward_claim(partner_id);

-- ---------------------------------------------------------------- keep-warm

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['client','project','project_area','board','board_item','quote','procurement_item']
  loop
    execute format(
      'drop trigger if exists %I_touch on %I; create trigger %I_touch before update on %I for each row execute function touch_updated_at()',
      t, t, t, t);
  end loop;
end $$;

-- ============================================================================
-- DEMO DATA — Material Depot for Partners
-- Target project: vmwvxwqzqxhwesjokztf.  Run AFTER 001_init.sql and 002_rls.sql.
--
-- Paste the whole file into Supabase → SQL Editor → Run. It is idempotent:
-- every row has a fixed id and re-running updates rather than duplicates, so
-- you can edit a number here and run it again.
--
-- This file, and both migrations, are exercised against a real Postgres by
-- `supabase/test` (51 assertions, including that one architect cannot read
-- another's data). Run that before changing any of them.
--
-- Dates are RELATIVE (current_date - 40, now() - interval '2 days'), so the
-- demo never looks stale no matter when it is shown.
--
-- It also sets up the demo login:
--     demo.studio@materialdepot.com  /  DemoStudio2026!
--
-- THIS IS ALL INVENTED. Product names and SKUs are shaped like real Material
-- Depot catalogue rows (TL 01103, TL 03538 …) so the screens look right, but
-- every price, quantity and rupee figure here is made up. Do not quote any of
-- it to anyone. `TRUNCATE` list at the bottom of this file removes the lot.
-- ============================================================================

-- --------------------------------------------------------------- 1. the firm
insert into partner (id, firm_name, contact_name, phone, email, city, gst, firm_type, onboarded_on) values
  ('0d0d0d0d-0000-4000-8000-000000000001', 'Studio Terra', 'Aarav Mehta', '9845012345',
   'demo.studio@materialdepot.com', 'Bengaluru', '29AAFCS1234A1Z5', 'architect', current_date - 210)
on conflict (id) do update set
  firm_name = excluded.firm_name, contact_name = excluded.contact_name,
  phone = excluded.phone, city = excluded.city, gst = excluded.gst;

-- ------------------------------------------------------------- 2. the login
-- The auth user already exists (created through the app's own sign-up), but
-- this project has email confirmation ON, so it cannot sign in yet. Confirm it
-- and attach it to the demo firm.
--
-- This runs AFTER the firm above, not before: partner_user.partner_id is a
-- foreign key, so linking first fails with 23503.
do $$
declare v_uid uuid;
begin
  select id into v_uid from auth.users where email = 'demo.studio@materialdepot.com';

  if v_uid is null then
    raise notice
      'No auth user demo.studio@materialdepot.com. Create it on the site''s Create-account form (any password), then re-run this file. Everything else below still loads.';
  else
    -- Confirm the address so the password login works.
    --
    -- Only `email_confirmed_at`. Do NOT touch `auth.users.confirmed_at` — it is
    -- a GENERATED column (`least(email_confirmed_at, phone_confirmed_at)`), and
    -- writing it fails with `428C9: column "confirmed_at" can only be updated
    -- to DEFAULT`. Setting email_confirmed_at updates it for free.
    update auth.users
       set email_confirmed_at = coalesce(email_confirmed_at, now())
     where id = v_uid;

    insert into partner_user (user_id, partner_id, role)
    values (v_uid, '0d0d0d0d-0000-4000-8000-000000000001', 'principal')
    on conflict (user_id) do update set partner_id = excluded.partner_id;
  end if;
end $$;

-- ------------------------------------------------------------- 2. clients
insert into client (id, partner_id, name, phone, email, city, address, notes, created_at) values
  ('11111111-1111-4111-8111-111111111101', '0d0d0d0d-0000-4000-8000-000000000001',
   'Sharma Family', '9845112233', 'r.sharma@example.in', 'Bengaluru',
   'Prestige Lakeside Habitat, Whitefield', 'Second project with them. Decides fast, wants warm neutrals.',
   now() - interval '190 days'),
  ('11111111-1111-4111-8111-111111111102', '0d0d0d0d-0000-4000-8000-000000000001',
   'Nikhil & Priya Rao', '9880223344', 'priya.rao@example.in', 'Bengaluru',
   '12th Main, Indiranagar', 'Both work in tech. Long decision cycles, very visual — show renders.',
   now() - interval '75 days'),
  ('11111111-1111-4111-8111-111111111103', '0d0d0d0d-0000-4000-8000-000000000001',
   'Anand Prakash', '9740334455', 'anand@prakashcafe.in', 'Bengaluru',
   'Sarjapur Road, near Wipro gate', 'Cafe owner. Second outlet. Cost-driven, needs durable surfaces.',
   now() - interval '120 days'),
  ('11111111-1111-4111-8111-111111111104', '0d0d0d0d-0000-4000-8000-000000000001',
   'Kavya Iyer', '9663445566', 'kavya.iyer@example.in', 'Bengaluru',
   '4th Block, Jayanagar', 'Just signed. Brief still forming.', now() - interval '18 days')
on conflict (id) do update set
  name = excluded.name, phone = excluded.phone, email = excluded.email,
  city = excluded.city, address = excluded.address, notes = excluded.notes;

-- ------------------------------------------------------------ 3. projects
insert into project (id, partner_id, client_id, name, site_address, city, project_type, stage, status,
                     carpet_area_sqft, budget, design_fee, started_on, target_on) values
  -- the flagship: fully populated through every tab
  ('22222222-2222-4222-8222-222222222201', '0d0d0d0d-0000-4000-8000-000000000001',
   '11111111-1111-4111-8111-111111111101', 'Sharma Residence — Whitefield',
   'Prestige Lakeside Habitat, Tower 4, Whitefield', 'Bengaluru', 'residential', 'procurement', 'active',
   2400, 4200000, 350000, current_date - 165, current_date + 55),
  ('22222222-2222-4222-8222-222222222202', '0d0d0d0d-0000-4000-8000-000000000001',
   '11111111-1111-4111-8111-111111111102', 'Rao Apartment — Indiranagar 3BHK',
   '12th Main, Indiranagar', 'Bengaluru', 'residential', 'design', 'active',
   1450, 1800000, 165000, current_date - 62, current_date + 120),
  ('22222222-2222-4222-8222-222222222203', '0d0d0d0d-0000-4000-8000-000000000001',
   '11111111-1111-4111-8111-111111111103', 'Prakash Café — Sarjapur',
   'Sarjapur Road', 'Bengaluru', 'hospitality', 'execution', 'active',
   1800, 2600000, 240000, current_date - 145, current_date + 12),
  ('22222222-2222-4222-8222-222222222204', '0d0d0d0d-0000-4000-8000-000000000001',
   '11111111-1111-4111-8111-111111111104', 'Iyer Villa — Jayanagar',
   '4th Block, Jayanagar', 'Bengaluru', 'residential', 'design', 'active',
   3100, 5500000, 480000, current_date - 15, current_date + 210),
  ('22222222-2222-4222-8222-222222222205', '0d0d0d0d-0000-4000-8000-000000000001',
   '11111111-1111-4111-8111-111111111101', 'Sharma Farmhouse — Nandi Hills',
   'Nandi Hills Road', 'Chikkaballapur', 'residential', 'design', 'on_hold',
   1900, 2200000, 200000, current_date - 90, null)
on conflict (id) do update set
  name = excluded.name, stage = excluded.stage, status = excluded.status,
  budget = excluded.budget, design_fee = excluded.design_fee,
  carpet_area_sqft = excluded.carpet_area_sqft, target_on = excluded.target_on;

-- --------------------------------------------------------------- 4. rooms
insert into project_area (id, project_id, area_type, name, floor_area_sqft, wall_area_sqft, status, sort_order, notes) values
  -- Sharma Residence
  ('33333333-3333-4333-8333-333333333301', '22222222-2222-4222-8222-222222222201', 'living_room',   'Living Room',    420, 780, 'finalised',   1, 'Double-height wall behind the sofa is the feature.'),
  ('33333333-3333-4333-8333-333333333302', '22222222-2222-4222-8222-222222222201', 'dining_room',   'Dining Room',    180, 420, 'finalised',   2, null),
  ('33333333-3333-4333-8333-333333333303', '22222222-2222-4222-8222-222222222201', 'kitchen',       'Kitchen',        140, 260, 'finalised',   3, 'Island. Client wants a quartz look, not real stone.'),
  ('33333333-3333-4333-8333-333333333304', '22222222-2222-4222-8222-222222222201', 'bathroom',      'Master Bath',     65, 210, 'finalised',   4, null),
  ('33333333-3333-4333-8333-333333333305', '22222222-2222-4222-8222-222222222201', 'bathroom',      'Guest Bath',      45, 150, 'shortlisted', 5, 'Two options still with the client.'),
  ('33333333-3333-4333-8333-333333333306', '22222222-2222-4222-8222-222222222201', 'bedroom',       'Master Bedroom', 220, 480, 'finalised',   6, null),
  ('33333333-3333-4333-8333-333333333307', '22222222-2222-4222-8222-222222222201', 'foyer',         'Foyer',           70, 180, 'exploring',   7, 'Waiting on the console design.'),
  -- Rao Apartment
  ('33333333-3333-4333-8333-333333333311', '22222222-2222-4222-8222-222222222202', 'living_room',   'Living Room',    310, 560, 'shortlisted', 1, null),
  ('33333333-3333-4333-8333-333333333312', '22222222-2222-4222-8222-222222222202', 'kitchen',       'Kitchen',        120, 220, 'finalised',   2, null),
  ('33333333-3333-4333-8333-333333333313', '22222222-2222-4222-8222-222222222202', 'bathroom',      'Common Bath',     42, 140, 'exploring',   3, null),
  ('33333333-3333-4333-8333-333333333314', '22222222-2222-4222-8222-222222222202', 'tv_unit',       'TV Unit',         null, 95, 'shortlisted', 4, 'Wall-hung, 8ft wide.'),
  -- Prakash Café
  ('33333333-3333-4333-8333-333333333321', '22222222-2222-4222-8222-222222222203', 'common',        'Seating Floor',  980, 1450, 'finalised',  1, null),
  ('33333333-3333-4333-8333-333333333322', '22222222-2222-4222-8222-222222222203', 'kitchen',       'Back Kitchen',   260, 480, 'finalised',   2, 'Anti-skid mandatory.'),
  ('33333333-3333-4333-8333-333333333323', '22222222-2222-4222-8222-222222222203', 'bathroom',      'Washroom',        70, 220, 'finalised',   3, null),
  ('33333333-3333-4333-8333-333333333324', '22222222-2222-4222-8222-222222222203', 'facade',        'Shopfront',       null, 340, 'finalised',  4, null),
  -- Iyer Villa
  ('33333333-3333-4333-8333-333333333331', '22222222-2222-4222-8222-222222222204', 'living_room',   'Living Room',    520, 900, 'exploring',   1, null),
  ('33333333-3333-4333-8333-333333333332', '22222222-2222-4222-8222-222222222204', 'staircase',     'Staircase',       null, 240, 'exploring',  2, null)
on conflict (id) do update set
  name = excluded.name, area_type = excluded.area_type, status = excluded.status,
  floor_area_sqft = excluded.floor_area_sqft, wall_area_sqft = excluded.wall_area_sqft,
  sort_order = excluded.sort_order, notes = excluded.notes;

-- --------------------------------------------------------------- 5. boards
-- Several options per room is the point: the client is shown two or three and
-- picks one. Exactly one board per FINALISED room is 'approved' — that is what
-- the quote gets built from.
--
-- Covers are real, publicly-served Material Depot scene photographs, the same
-- ones palette.materialdepot.com shows in its gallery.
--
-- They are `/cdn-img/azure/application_image/<scene>-medres.jpg`, NOT
-- `/cdn-img/main/general-images/<uuid>.png`. The uuid ones are the scene's
-- compositing LAYERS — they fetch 200 and are near-transparent, so they render
-- as blank white boxes. That is what the first version of this file used.
-- Product rows carry no image for the same reason: palette draws its swatches
-- to a canvas, so there is no per-product URL to point at, and a neutral
-- placeholder beats a blank one.
insert into board (id, area_id, name, palette_scene, cover_url, status, approved_at, notes) values
  -- Living Room: three options, client picked the second
  ('44444444-4444-4444-8444-444444440101', '33333333-3333-4333-8333-333333333301', 'Option 1 — Warm Travertine', null,
   null,
   'rejected', null, 'Client felt it read too beige against the north light.'),
  ('44444444-4444-4444-8444-444444440102', '33333333-3333-4333-8333-333333333301', 'Option 2 — Breccia & Oak', null,
   'https://palette.materialdepot.com/cdn-img/azure/application_image/living-room-with-arch-mouldings-original_medres.jpg?width=800&format=webp',
   'approved', now() - interval '38 days', 'Signed off on site. Oak louver behind the sofa is the hero.'),
  ('44444444-4444-4444-8444-444444440103', '33333333-3333-4333-8333-333333333301', 'Option 3 — Dark Moody', null,
   null,
   'rejected', null, null),
  -- Dining
  ('44444444-4444-4444-8444-444444440201', '33333333-3333-4333-8333-333333333302', 'Option 1 — Terrazzo Feature', null,
   'https://palette.materialdepot.com/cdn-img/azure/application_image/dining-wall-01-original_medres.jpg?width=800&format=webp',
   'approved', now() - interval '38 days', 'Same floor as living, terrazzo on the buffet wall.'),
  -- Kitchen
  ('44444444-4444-4444-8444-444444440301', '33333333-3333-4333-8333-333333333303', 'Option 1 — Ivory & Quartz', null,
   'https://palette.materialdepot.com/cdn-img/azure/application_image/l-shape-kitchen-with-glass-shelf-medres.jpg?width=800&format=webp',
   'approved', now() - interval '36 days', null),
  ('44444444-4444-4444-8444-444444440302', '33333333-3333-4333-8333-333333333303', 'Option 2 — Graphite', null, null, 'rejected', null, null),
  -- Master Bath — built in palette, scene slug kept so the link reopens it
  ('44444444-4444-4444-8444-444444440401', '33333333-3333-4333-8333-333333333304', 'Option 1 — Brown Glossy + Subway',
   'abstract-geometric-tile-bathroom-with-subway-tiles',
   'https://palette.materialdepot.com/cdn-img/azure/application_image/abstract-geometric-tile-bathroom-with-subway-tiles-medres.jpg?width=800&format=webp',
   'approved', now() - interval '34 days', 'Visualised in Palette before the client meeting — that sold it.'),
  ('44444444-4444-4444-8444-444444440402', '33333333-3333-4333-8333-333333333304', 'Option 2 — All Marble', 'https://palette.materialdepot.com/cdn-img/azure/application_image/marble-bathroom-linear-layout-with-highlighter-shower-area-medres.webp?width=800&format=webp', null, 'rejected', null, null),
  -- Guest Bath: still with the client, NOTHING approved — so it is deliberately
  -- absent from the quote, and the Quote tab says so
  ('44444444-4444-4444-8444-444444440501', '33333333-3333-4333-8333-333333333305', 'Option 1 — Green Zellige', null,
   'https://palette.materialdepot.com/cdn-img/azure/application_image/earthy-bathroom-split-half-subway-tiles-medres.jpg?width=800&format=webp',
   'shared', null, 'Shared 4 days ago, no answer yet.'),
  ('44444444-4444-4444-8444-444444440502', '33333333-3333-4333-8333-333333333305', 'Option 2 — Black & White Geometric', null,
   'https://palette.materialdepot.com/cdn-img/azure/application_image/black-white-geometric-tiled-bathroom-with-plain-base-medres.jpg?width=800&format=webp',
   'shared', null, null),
  -- Master Bedroom
  ('44444444-4444-4444-8444-444444440601', '33333333-3333-4333-8333-333333333306', 'Option 1 — Oak & Linen', null,
   'https://palette.materialdepot.com/cdn-img/azure/application_image/bedroom-with-arched-mouldings_medres.jpg?width=800&format=webp',
   'approved', now() - interval '33 days', null),
  -- Rao Apartment: design stage, kitchen decided, the rest still open
  ('44444444-4444-4444-8444-444444441101', '33333333-3333-4333-8333-333333333311', 'Option 1 — Light Oak', null,
   'https://palette.materialdepot.com/cdn-img/azure/application_image/living-room-with-arch-mouldings-original_medres.jpg?width=800&format=webp',
   'shared', null, null),
  ('44444444-4444-4444-8444-444444441102', '33333333-3333-4333-8333-333333333311', 'Option 2 — Concrete & Brass', null, null, 'draft', null, null),
  ('44444444-4444-4444-8444-444444441201', '33333333-3333-4333-8333-333333333312', 'Option 1 — White Handleless', null,
   'https://palette.materialdepot.com/cdn-img/azure/application_image/u-shape-luxury-kitchen-highres-original_medres.jpeg?width=800&format=webp',
   'approved', now() - interval '9 days', null),
  ('44444444-4444-4444-8444-444444441401', '33333333-3333-4333-8333-333333333314', 'Option 1 — Fluted Panel', 'https://palette.materialdepot.com/cdn-img/azure/application_image/modern-tv-unit-with-fluted-panels-medres.jpg?width=800&format=webp', null, 'draft', null, null),
  -- Prakash Café
  ('44444444-4444-4444-8444-444444442101', '33333333-3333-4333-8333-333333333321', 'Final — Terrazzo Floor', null,
   null,
   'approved', now() - interval '110 days', null),
  ('44444444-4444-4444-8444-444444442201', '33333333-3333-4333-8333-333333333322', 'Final — Anti-skid', null, null, 'approved', now() - interval '110 days', 'Anti-skid is a licence condition, not a preference.'),
  ('44444444-4444-4444-8444-444444442301', '33333333-3333-4333-8333-333333333323', 'Final — Subway Washroom', null, null, 'approved', now() - interval '108 days', null),
  ('44444444-4444-4444-8444-444444442401', '33333333-3333-4333-8333-333333333324', 'Final — Louver Shopfront', null, null, 'approved', now() - interval '105 days', null)
on conflict (id) do update set
  name = excluded.name, palette_scene = excluded.palette_scene, cover_url = excluded.cover_url,
  status = excluded.status, approved_at = excluded.approved_at, notes = excluded.notes;

-- --------------------------------------------------- 6. products on boards
-- `rate` is TAX-INCLUSIVE throughout — the same convention as the catalogue's
-- `selling_price_with_tax`. `priced_at` is what the app uses to tell the
-- architect how old a quote's prices are.
--
-- Note the deliberate spread of units: sqft, box (with a coverage area, so the
-- app can work quantities out), roll, and nos (which it cannot, and says so).
insert into board_item (id, board_id, kind, surface, variant_id, sku, product_name, brand, category,
                        size, finish, image_url, md_url, unit, rate, mrp, gst_pct, coverage_area,
                        priced_at, qty, wastage_pct, note, sort_order) values
  -- ---- Living Room, approved board
  ('55555555-5555-4555-8555-555555550101', '44444444-4444-4444-8444-444444440102', 'product', 'Floor',
   'v-tl03547', 'TL 03547', 'Royal Breccia 1800x1200 mm Glossy Finish', 'Simpolo', 'Tiles', '1800x1200', 'Glossy',
   null,
   'https://materialdepot.com/product/royal-breccia-1800x1200-glossy', 'sqft', 218.50, 265.00, 18, null,
   now() - interval '40 days', 441, 5, null, 1),
  ('55555555-5555-4555-8555-555555550102', '44444444-4444-4444-8444-444444440102', 'product', 'Feature Wall',
   'v-lv2210', 'LV 2210', 'Fluted Oak Louver Panel 12mm', 'Greenlam', 'Louvers', '2400x300', 'Matte',
   null,
   null, 'sqft', 340.00, 425.00, 18, null, now() - interval '40 days', 96, 8, 'Behind the sofa, floor to ceiling.', 2),
  ('55555555-5555-4555-8555-555555550103', '44444444-4444-4444-8444-444444440102', 'product', 'Skirting',
   'v-sk1180', 'SK 1180', 'Matching Breccia Skirting 100mm', 'Simpolo', 'Tiles', '1200x100', 'Glossy',
   null, null, 'rft', 96.00, 120.00, 18, null, now() - interval '40 days', 84, 5, null, 3),
  -- ---- Dining, approved
  ('55555555-5555-4555-8555-555555550201', '44444444-4444-4444-8444-444444440201', 'product', 'Floor',
   'v-tl03547', 'TL 03547', 'Royal Breccia 1800x1200 mm Glossy Finish', 'Simpolo', 'Tiles', '1800x1200', 'Glossy',
   null,
   'https://materialdepot.com/product/royal-breccia-1800x1200-glossy', 'sqft', 218.50, 265.00, 18, null,
   now() - interval '40 days', 189, 5, 'Runs continuous from the living room.', 1),
  ('55555555-5555-4555-8555-555555550202', '44444444-4444-4444-8444-444444440201', 'product', 'Feature Wall',
   'v-tl01103', 'TL 01103', 'Vibrant Terrazo Carving Matte Finish 600x1200', 'Orientbell', 'Tiles', '1200x600', 'Matte',
   null,
   'https://materialdepot.com/product/vibrant-terrazo-carving-600x1200', 'sqft', 128.00, 168.00, 18, null,
   now() - interval '40 days', 116, 6, 'Buffet wall only.', 2),
  -- ---- Kitchen, approved. The floor tile is sold BY THE BOX with a coverage
  -- area, which is what lets the app compute boxes from the room's floor area.
  ('55555555-5555-4555-8555-555555550301', '44444444-4444-4444-8444-444444440301', 'product', 'Floor',
   'v-tl06622', 'TL 06622', 'Anti-Skid Vitrified 600x600 Matte — Grey', 'Kajaria', 'Tiles', '600x600', 'Anti-skid Matte',
   null,
   null, 'box', 1180.00, 1450.00, 18, 15.50, now() - interval '38 days', 10, 6, null, 1),
  ('55555555-5555-4555-8555-555555550302', '44444444-4444-4444-8444-444444440301', 'product', 'Backsplash',
   'v-tl04961g', 'TL 04961 G', 'Subway Matte Finish Glacier White Ceramic Wall Tile', 'Nitco', 'Tiles', '300x75', 'Matte',
   null,
   'https://materialdepot.com/product/subway-matte-glacier-white-300x75', 'sqft', 96.00, 125.00, 18, null,
   now() - interval '38 days', 64, 10, 'Stack bond, not running bond.', 2),
  ('55555555-5555-4555-8555-555555550303', '44444444-4444-4444-8444-444444440301', 'product', 'Countertop',
   'v-qz8840', 'QZ 8840', 'Engineered Quartz Calacatta 20mm', 'Kalinga', 'Countertops', '3200x1600', 'Polished',
   null, null, 'sqft', 640.00, 780.00, 18, null, now() - interval '38 days', 48, 4, null, 3),
  ('55555555-5555-4555-8555-555555550304', '44444444-4444-4444-8444-444444440301', 'product', 'Cabinet Front',
   'v-lm3312', 'LM 3312', 'Acrylic Laminate Ivory High Gloss 1mm', 'Merino', 'Laminates', '2440x1220', 'High Gloss',
   null, null, 'sqft', 175.00, 210.00, 18, null, now() - interval '38 days', 212, 7, null, 4),
  -- ---- Master Bath, approved (built in Palette)
  ('55555555-5555-4555-8555-555555550401', '44444444-4444-4444-8444-444444440401', 'product', 'Floor',
   'v-tl05510', 'TL 05510', 'Marble Look 600x600 Matte — Bianco', 'Somany', 'Tiles', '600x600', 'Matte',
   null,
   null, 'sqft', 168.00, 205.00, 18, null, now() - interval '36 days', 69, 6, null, 1),
  ('55555555-5555-4555-8555-555555550402', '44444444-4444-4444-8444-444444440401', 'product', 'Lower Half Wall',
   'v-tl03538', 'TL 03538', 'Brown Glossy Finish 6ft x 4ft Glazed Vitrified', 'Simpolo', 'Tiles', '1800x1200', 'Glossy',
   null,
   'https://materialdepot.com/product/brown-glossy-1800x1200-glazed', 'sqft', 192.00, 240.00, 18, null,
   now() - interval '36 days', 118, 8, null, 2),
  ('55555555-5555-4555-8555-555555550403', '44444444-4444-4444-8444-444444440401', 'product', 'Upper Half Wall',
   'v-tl04961g', 'TL 04961 G', 'Subway Matte Finish Glacier White Ceramic Wall Tile', 'Nitco', 'Tiles', '300x75', 'Matte',
   null,
   'https://materialdepot.com/product/subway-matte-glacier-white-300x75', 'sqft', 96.00, 125.00, 18, null,
   now() - interval '36 days', 108, 10, null, 3),
  ('55555555-5555-4555-8555-555555550404', '44444444-4444-4444-8444-444444440401', 'product', 'Highlighter',
   'v-tl07731', 'TL 07731', 'Moroccan Pattern Highlighter 200x200', 'Orientbell', 'Tiles', '200x200', 'Matte',
   null,
   null, 'sqft', 245.00, 310.00, 18, null, now() - interval '36 days', 26, 10, 'Shower niche band.', 4),
  ('55555555-5555-4555-8555-555555550405', '44444444-4444-4444-8444-444444440401', 'product', 'Countertop',
   'v-qz8840', 'QZ 8840', 'Engineered Quartz Calacatta 20mm', 'Kalinga', 'Countertops', '3200x1600', 'Polished',
   null, null, 'sqft', 640.00, 780.00, 18, null, now() - interval '36 days', 13, 4, null, 5),
  -- Sold by the piece, so no area on earth computes the quantity — the app
  -- says "not an area, so the quantity has to be entered", and it was.
  ('55555555-5555-4555-8555-555555550406', '44444444-4444-4444-8444-444444440401', 'product', 'Shower Area',
   'v-sn2204', 'SN 2204', 'Linear Shower Drain 600mm Brushed Brass', 'Jaquar', 'Sanitaryware', '600mm', 'Brushed Brass',
   null, null, 'nos', 8450.00, 10200.00, 18, null, now() - interval '36 days', 1, 0, null, 6),
  -- ---- Guest Bath: two options still with the client, so these never reach
  -- the quote. Deliberate — the Quote tab reports the room as not signed off.
  ('55555555-5555-4555-8555-555555550501', '44444444-4444-4444-8444-444444440501', 'product', 'Lower Half Wall',
   'v-tl09912', 'TL 09912', 'Zellige Look Green Gloss 100x100', 'Orientbell', 'Tiles', '100x100', 'Gloss',
   null,
   null, 'sqft', 285.00, 350.00, 18, null, now() - interval '4 days', 84, 12, null, 1),
  ('55555555-5555-4555-8555-555555550502', '44444444-4444-4444-8444-444444440502', 'product', 'Floor',
   'v-tl02218', 'TL 02218', 'Black & White Geometric Pattern 200x200', 'Nitco', 'Tiles', '200x200', 'Matte',
   null,
   null, 'sqft', 178.00, 220.00, 18, null, now() - interval '4 days', 48, 10, null, 1),
  -- ---- Master Bedroom, approved
  ('55555555-5555-4555-8555-555555550601', '44444444-4444-4444-8444-444444440601', 'product', 'Floor',
   'v-wf4420', 'WF 4420', 'Engineered Oak Plank 14mm Natural', 'Pergo', 'Wooden Flooring', '1830x190', 'Matte Lacquer',
   null,
   null, 'box', 4850.00, 5900.00, 18, 21.50, now() - interval '34 days', 11, 6, null, 1),
  ('55555555-5555-4555-8555-555555550602', '44444444-4444-4444-8444-444444440601', 'product', 'Headboard Wall',
   'v-wp6612', 'WP 6612', 'Textured Linen Wallpaper — Oat', 'Marshalls', 'Wallpaper', '10m x 53cm', 'Textured',
   null, null, 'roll', 4200.00, 5100.00, 18, 55.00, now() - interval '34 days', 2, 10, null, 2),
  -- ---- Rao kitchen, approved
  ('55555555-5555-4555-8555-555555551201', '44444444-4444-4444-8444-444444441201', 'product', 'Cabinet Front',
   'v-lm3301', 'LM 3301', 'Acrylic Laminate Arctic White Matte 1mm', 'Merino', 'Laminates', '2440x1220', 'Matte',
   null, null, 'sqft', 168.00, 205.00, 18, null, now() - interval '9 days', 182, 7, null, 1),
  ('55555555-5555-4555-8555-555555551202', '44444444-4444-4444-8444-444444441201', 'product', 'Countertop',
   'v-qz8812', 'QZ 8812', 'Engineered Quartz Pure White 20mm', 'Kalinga', 'Countertops', '3200x1600', 'Polished',
   null, null, 'sqft', 585.00, 700.00, 18, null, now() - interval '9 days', 42, 4, null, 2),
  -- ---- Rao living room, still an option
  ('55555555-5555-4555-8555-555555551101', '44444444-4444-4444-8444-444444441101', 'product', 'Floor',
   'v-wf4402', 'WF 4402', 'Engineered Oak Plank 14mm Light', 'Pergo', 'Wooden Flooring', '1830x190', 'Matte Lacquer',
   null,
   null, 'box', 4650.00, 5600.00, 18, 21.50, now() - interval '11 days', 16, 6, null, 1),
  -- ---- Prakash Café
  ('55555555-5555-4555-8555-555555552101', '44444444-4444-4444-8444-444444442101', 'product', 'Floor',
   'v-tl01103', 'TL 01103', 'Vibrant Terrazo Carving Matte Finish 600x1200', 'Orientbell', 'Tiles', '1200x600', 'Matte',
   null,
   'https://materialdepot.com/product/vibrant-terrazo-carving-600x1200', 'sqft', 128.00, 168.00, 18, null,
   now() - interval '112 days', 1029, 5, null, 1),
  ('55555555-5555-4555-8555-555555552201', '44444444-4444-4444-8444-444444442201', 'product', 'Floor',
   'v-tl06622', 'TL 06622', 'Anti-Skid Vitrified 600x600 Matte — Grey', 'Kajaria', 'Tiles', '600x600', 'Anti-skid Matte',
   null, null, 'box', 1180.00, 1450.00, 18, 15.50, now() - interval '112 days', 18, 6, null, 1),
  ('55555555-5555-4555-8555-555555552301', '44444444-4444-4444-8444-444444442301', 'product', 'Lower Half Wall',
   'v-tl04961g', 'TL 04961 G', 'Subway Matte Finish Glacier White Ceramic Wall Tile', 'Nitco', 'Tiles', '300x75', 'Matte',
   null, 'https://materialdepot.com/product/subway-matte-glacier-white-300x75', 'sqft', 96.00, 125.00, 18, null,
   now() - interval '112 days', 231, 10, null, 1),
  ('55555555-5555-4555-8555-555555552401', '44444444-4444-4444-8444-444444442401', 'product', 'Facade',
   'v-lv2240', 'LV 2240', 'WPC Louver Charcoal 40x25mm', 'Greenlam', 'Louvers', '2900x40', 'Matte',
   null, null, 'sqft', 268.00, 330.00, 18, null, now() - interval '110 days', 357, 8, null, 1)
on conflict (id) do update set
  surface = excluded.surface, product_name = excluded.product_name, brand = excluded.brand,
  sku = excluded.sku, size = excluded.size, finish = excluded.finish, image_url = excluded.image_url,
  md_url = excluded.md_url, unit = excluded.unit, rate = excluded.rate, mrp = excluded.mrp,
  gst_pct = excluded.gst_pct, coverage_area = excluded.coverage_area, priced_at = excluded.priced_at,
  qty = excluded.qty, wastage_pct = excluded.wastage_pct, note = excluded.note, sort_order = excluded.sort_order;

-- --------------------------------------------------------------- 7. quotes
-- v1 was shared and superseded; v2 is the one the client accepted. Both are
-- SNAPSHOTS — the lines carry their own rates, so editing a board later cannot
-- change what was sent.
insert into quote (id, project_id, version, title, status, markup_pct, discount, valid_until,
                   shared_at, decided_at, notes, created_at) values
  ('66666666-6666-4666-8666-666666660101', '22222222-2222-4222-8222-222222222201', 1, 'Quote v1', 'superseded',
   15, 0, current_date - 30, now() - interval '44 days', null,
   'Superseded — client changed the living room floor and added the terrazzo feature wall.', now() - interval '45 days'),
  ('66666666-6666-4666-8666-666666660102', '22222222-2222-4222-8222-222222222201', 2, 'Quote v2', 'accepted',
   18, 25000, current_date + 10, now() - interval '32 days', now() - interval '28 days',
   'Covers Material Depot supply only. Labour, false ceiling and electricals are billed separately.',
   now() - interval '33 days'),
  ('66666666-6666-4666-8666-666666660301', '22222222-2222-4222-8222-222222222203', 1, 'Quote v1', 'accepted',
   20, 0, current_date - 90, now() - interval '118 days', now() - interval '115 days', null, now() - interval '119 days')
on conflict (id) do update set
  status = excluded.status, markup_pct = excluded.markup_pct, discount = excluded.discount,
  valid_until = excluded.valid_until, shared_at = excluded.shared_at, decided_at = excluded.decided_at,
  notes = excluded.notes;

insert into quote_line (id, quote_id, board_item_id, area_id, area_label, description, sku, variant_id,
                        qty, unit, rate, gst_pct, line_markup_pct, sort_order) values
  -- v1: the shape the first quote had, before the client changed their mind
  ('77777777-7777-4777-8777-777777770001', '66666666-6666-4666-8666-666666660101', null, '33333333-3333-4333-8333-333333333301', 'Living Room',
   'Warm Travertine 800x800 Matte · Floor', 'TL 02290', 'v-tl02290', 445, 'sqft', 186.00, 18, null, 1),
  ('77777777-7777-4777-8777-777777770002', '66666666-6666-4666-8666-666666660101', null, '33333333-3333-4333-8333-333333333302', 'Dining Room',
   'Warm Travertine 800x800 Matte · Floor', 'TL 02290', 'v-tl02290', 190, 'sqft', 186.00, 18, null, 2),
  ('77777777-7777-4777-8777-777777770003', '66666666-6666-4666-8666-666666660101', null, '33333333-3333-4333-8333-333333333303', 'Kitchen',
   'Engineered Quartz Calacatta 20mm · Countertop', 'QZ 8840', 'v-qz8840', 48, 'sqft', 640.00, 18, null, 3),
  ('77777777-7777-4777-8777-777777770004', '66666666-6666-4666-8666-666666660101', null, '33333333-3333-4333-8333-333333333304', 'Master Bath',
   'Marble Look 600x600 Matte — Bianco · Floor', 'TL 05510', 'v-tl05510', 69, 'sqft', 168.00, 18, null, 4),

  -- v2: the accepted one, copied off the approved boards
  ('77777777-7777-4777-8777-777777770101', '66666666-6666-4666-8666-666666660102', '55555555-5555-4555-8555-555555550101', '33333333-3333-4333-8333-333333333301', 'Living Room',
   'Royal Breccia 1800x1200 mm Glossy Finish · 1800x1200 · Floor', 'TL 03547', 'v-tl03547', 441, 'sqft', 218.50, 18, null, 1),
  ('77777777-7777-4777-8777-777777770102', '66666666-6666-4666-8666-666666660102', '55555555-5555-4555-8555-555555550102', '33333333-3333-4333-8333-333333333301', 'Living Room',
   'Fluted Oak Louver Panel 12mm · 2400x300 · Feature Wall', 'LV 2210', 'v-lv2210', 96, 'sqft', 340.00, 18, null, 2),
  ('77777777-7777-4777-8777-777777770103', '66666666-6666-4666-8666-666666660102', '55555555-5555-4555-8555-555555550103', '33333333-3333-4333-8333-333333333301', 'Living Room',
   'Matching Breccia Skirting 100mm · 1200x100 · Skirting', 'SK 1180', 'v-sk1180', 84, 'rft', 96.00, 18, null, 3),
  ('77777777-7777-4777-8777-777777770104', '66666666-6666-4666-8666-666666660102', '55555555-5555-4555-8555-555555550201', '33333333-3333-4333-8333-333333333302', 'Dining Room',
   'Royal Breccia 1800x1200 mm Glossy Finish · 1800x1200 · Floor', 'TL 03547', 'v-tl03547', 189, 'sqft', 218.50, 18, null, 4),
  ('77777777-7777-4777-8777-777777770105', '66666666-6666-4666-8666-666666660102', '55555555-5555-4555-8555-555555550202', '33333333-3333-4333-8333-333333333302', 'Dining Room',
   'Vibrant Terrazo Carving Matte Finish 600x1200 · 1200x600 · Feature Wall', 'TL 01103', 'v-tl01103', 116, 'sqft', 128.00, 18, null, 5),
  ('77777777-7777-4777-8777-777777770106', '66666666-6666-4666-8666-666666660102', '55555555-5555-4555-8555-555555550301', '33333333-3333-4333-8333-333333333303', 'Kitchen',
   'Anti-Skid Vitrified 600x600 Matte — Grey · 600x600 · Floor', 'TL 06622', 'v-tl06622', 10, 'box', 1180.00, 18, null, 6),
  ('77777777-7777-4777-8777-777777770107', '66666666-6666-4666-8666-666666660102', '55555555-5555-4555-8555-555555550302', '33333333-3333-4333-8333-333333333303', 'Kitchen',
   'Subway Matte Finish Glacier White Ceramic Wall Tile · 300x75 · Backsplash', 'TL 04961 G', 'v-tl04961g', 64, 'sqft', 96.00, 18, null, 7),
  ('77777777-7777-4777-8777-777777770108', '66666666-6666-4666-8666-666666660102', '55555555-5555-4555-8555-555555550303', '33333333-3333-4333-8333-333333333303', 'Kitchen',
   'Engineered Quartz Calacatta 20mm · 3200x1600 · Countertop', 'QZ 8840', 'v-qz8840', 48, 'sqft', 640.00, 18, null, 8),
  ('77777777-7777-4777-8777-777777770109', '66666666-6666-4666-8666-666666660102', '55555555-5555-4555-8555-555555550304', '33333333-3333-4333-8333-333333333303', 'Kitchen',
   'Acrylic Laminate Ivory High Gloss 1mm · 2440x1220 · Cabinet Front', 'LM 3312', 'v-lm3312', 212, 'sqft', 175.00, 18, 22, 9),
  ('77777777-7777-4777-8777-777777770110', '66666666-6666-4666-8666-666666660102', '55555555-5555-4555-8555-555555550401', '33333333-3333-4333-8333-333333333304', 'Master Bath',
   'Marble Look 600x600 Matte — Bianco · 600x600 · Floor', 'TL 05510', 'v-tl05510', 69, 'sqft', 168.00, 18, null, 10),
  ('77777777-7777-4777-8777-777777770111', '66666666-6666-4666-8666-666666660102', '55555555-5555-4555-8555-555555550402', '33333333-3333-4333-8333-333333333304', 'Master Bath',
   'Brown Glossy Finish 6ft x 4ft Glazed Vitrified · 1800x1200 · Lower Half Wall', 'TL 03538', 'v-tl03538', 118, 'sqft', 192.00, 18, null, 11),
  ('77777777-7777-4777-8777-777777770112', '66666666-6666-4666-8666-666666660102', '55555555-5555-4555-8555-555555550403', '33333333-3333-4333-8333-333333333304', 'Master Bath',
   'Subway Matte Finish Glacier White Ceramic Wall Tile · 300x75 · Upper Half Wall', 'TL 04961 G', 'v-tl04961g', 108, 'sqft', 96.00, 18, null, 12),
  ('77777777-7777-4777-8777-777777770113', '66666666-6666-4666-8666-666666660102', '55555555-5555-4555-8555-555555550404', '33333333-3333-4333-8333-333333333304', 'Master Bath',
   'Moroccan Pattern Highlighter 200x200 · 200x200 · Highlighter', 'TL 07731', 'v-tl07731', 26, 'sqft', 245.00, 18, 25, 13),
  ('77777777-7777-4777-8777-777777770114', '66666666-6666-4666-8666-666666660102', '55555555-5555-4555-8555-555555550405', '33333333-3333-4333-8333-333333333304', 'Master Bath',
   'Engineered Quartz Calacatta 20mm · 3200x1600 · Countertop', 'QZ 8840', 'v-qz8840', 13, 'sqft', 640.00, 18, null, 14),
  ('77777777-7777-4777-8777-777777770115', '66666666-6666-4666-8666-666666660102', '55555555-5555-4555-8555-555555550406', '33333333-3333-4333-8333-333333333304', 'Master Bath',
   'Linear Shower Drain 600mm Brushed Brass · 600mm · Shower Area', 'SN 2204', 'v-sn2204', 1, 'nos', 8450.00, 18, null, 15),
  ('77777777-7777-4777-8777-777777770116', '66666666-6666-4666-8666-666666660102', '55555555-5555-4555-8555-555555550601', '33333333-3333-4333-8333-333333333306', 'Master Bedroom',
   'Engineered Oak Plank 14mm Natural · 1830x190 · Floor', 'WF 4420', 'v-wf4420', 11, 'box', 4850.00, 18, null, 16),
  ('77777777-7777-4777-8777-777777770117', '66666666-6666-4666-8666-666666660102', '55555555-5555-4555-8555-555555550602', '33333333-3333-4333-8333-333333333306', 'Master Bedroom',
   'Textured Linen Wallpaper — Oat · 10m x 53cm · Headboard Wall', 'WP 6612', 'v-wp6612', 2, 'roll', 4200.00, 18, null, 17),

  -- Café
  ('77777777-7777-4777-8777-777777770301', '66666666-6666-4666-8666-666666660301', '55555555-5555-4555-8555-555555552101', '33333333-3333-4333-8333-333333333321', 'Seating Floor',
   'Vibrant Terrazo Carving Matte Finish 600x1200 · Floor', 'TL 01103', 'v-tl01103', 1029, 'sqft', 128.00, 18, null, 1),
  ('77777777-7777-4777-8777-777777770302', '66666666-6666-4666-8666-666666660301', '55555555-5555-4555-8555-555555552201', '33333333-3333-4333-8333-333333333322', 'Back Kitchen',
   'Anti-Skid Vitrified 600x600 Matte — Grey · Floor', 'TL 06622', 'v-tl06622', 18, 'box', 1180.00, 18, null, 2),
  ('77777777-7777-4777-8777-777777770303', '66666666-6666-4666-8666-666666660301', '55555555-5555-4555-8555-555555552301', '33333333-3333-4333-8333-333333333323', 'Washroom',
   'Subway Matte Finish Glacier White · Lower Half Wall', 'TL 04961 G', 'v-tl04961g', 231, 'sqft', 96.00, 18, null, 3),
  ('77777777-7777-4777-8777-777777770304', '66666666-6666-4666-8666-666666660301', '55555555-5555-4555-8555-555555552401', '33333333-3333-4333-8333-333333333324', 'Shopfront',
   'WPC Louver Charcoal 40x25mm · Facade', 'LV 2240', 'v-lv2240', 357, 'sqft', 268.00, 18, null, 4)
on conflict (id) do update set
  description = excluded.description, qty = excluded.qty, unit = excluded.unit, rate = excluded.rate,
  gst_pct = excluded.gst_pct, line_markup_pct = excluded.line_markup_pct,
  area_label = excluded.area_label, sort_order = excluded.sort_order;

-- ---------------------------------------------------------- 8. procurement
-- Seeded from quote v2's lines, then moved on as material actually arrived.
-- Progress here is measured in QUANTITY, not row counts — half a room's tiles
-- landing is not "one line done".
insert into procurement_item (id, project_id, quote_line_id, area_id, area_label, description, sku, variant_id,
                              unit, qty_required, qty_ordered, qty_delivered, qty_installed, rate, status,
                              supplier, md_enq_id, expected_on, delivered_on, notes) values
  ('88888888-8888-4888-8888-888888880101', '22222222-2222-4222-8222-222222222201', '77777777-7777-4777-8777-777777770101', '33333333-3333-4333-8333-333333333301', 'Living Room',
   'Royal Breccia 1800x1200 mm Glossy Finish · Floor', 'TL 03547', 'v-tl03547', 'sqft', 441, 441, 441, 441, 218.50,
   'installed', 'Material Depot', 'ENQ2026072884321', current_date - 24, current_date - 22, null),
  ('88888888-8888-4888-8888-888888880102', '22222222-2222-4222-8222-222222222201', '77777777-7777-4777-8777-777777770102', '33333333-3333-4333-8333-333333333301', 'Living Room',
   'Fluted Oak Louver Panel 12mm · Feature Wall', 'LV 2210', 'v-lv2210', 'sqft', 96, 96, 96, 0, 340.00,
   'delivered', 'Material Depot', 'ENQ2026072884321', current_date - 20, current_date - 18, 'On site, carpenter starts Monday.'),
  ('88888888-8888-4888-8888-888888880103', '22222222-2222-4222-8222-222222222201', '77777777-7777-4777-8777-777777770103', '33333333-3333-4333-8333-333333333301', 'Living Room',
   'Matching Breccia Skirting 100mm · Skirting', 'SK 1180', 'v-sk1180', 'rft', 84, 84, 84, 84, 96.00,
   'installed', 'Material Depot', 'ENQ2026072884321', current_date - 24, current_date - 22, null),
  ('88888888-8888-4888-8888-888888880104', '22222222-2222-4222-8222-222222222201', '77777777-7777-4777-8777-777777770104', '33333333-3333-4333-8333-333333333302', 'Dining Room',
   'Royal Breccia 1800x1200 mm Glossy Finish · Floor', 'TL 03547', 'v-tl03547', 'sqft', 189, 189, 189, 189, 218.50,
   'installed', 'Material Depot', 'ENQ2026072884321', current_date - 24, current_date - 22, null),
  ('88888888-8888-4888-8888-888888880105', '22222222-2222-4222-8222-222222222201', '77777777-7777-4777-8777-777777770105', '33333333-3333-4333-8333-333333333302', 'Dining Room',
   'Vibrant Terrazo Carving Matte Finish 600x1200 · Feature Wall', 'TL 01103', 'v-tl01103', 'sqft', 116, 116, 116, 0, 128.00,
   'delivered', 'Material Depot', 'ENQ2026080691204', current_date - 8, current_date - 6, null),
  ('88888888-8888-4888-8888-888888880106', '22222222-2222-4222-8222-222222222201', '77777777-7777-4777-8777-777777770106', '33333333-3333-4333-8333-333333333303', 'Kitchen',
   'Anti-Skid Vitrified 600x600 Matte — Grey · Floor', 'TL 06622', 'v-tl06622', 'box', 10, 10, 10, 0, 1180.00,
   'delivered', 'Material Depot', 'ENQ2026080691204', current_date - 8, current_date - 6, null),
  ('88888888-8888-4888-8888-888888880107', '22222222-2222-4222-8222-222222222201', '77777777-7777-4777-8777-777777770107', '33333333-3333-4333-8333-333333333303', 'Kitchen',
   'Subway Matte Finish Glacier White · Backsplash', 'TL 04961 G', 'v-tl04961g', 'sqft', 64, 64, 0, 0, 96.00,
   'ordered', 'Material Depot', 'ENQ2026080691204', current_date + 4, null, null),
  ('88888888-8888-4888-8888-888888880108', '22222222-2222-4222-8222-222222222201', '77777777-7777-4777-8777-777777770108', '33333333-3333-4333-8333-333333333303', 'Kitchen',
   'Engineered Quartz Calacatta 20mm · Countertop', 'QZ 8840', 'v-qz8840', 'sqft', 48, 48, 0, 0, 640.00,
   'dispatched', 'Material Depot', 'ENQ2026080691204', current_date + 2, null, 'Template taken, slab cut in progress.'),
  ('88888888-8888-4888-8888-888888880109', '22222222-2222-4222-8222-222222222201', '77777777-7777-4777-8777-777777770109', '33333333-3333-4333-8333-333333333303', 'Kitchen',
   'Acrylic Laminate Ivory High Gloss 1mm · Cabinet Front', 'LM 3312', 'v-lm3312', 'sqft', 212, 0, 0, 0, 175.00,
   'pending', 'Material Depot', null, current_date + 16, null, 'Waiting on final shutter sizes from the carpenter.'),
  ('88888888-8888-4888-8888-888888880110', '22222222-2222-4222-8222-222222222201', '77777777-7777-4777-8777-777777770110', '33333333-3333-4333-8333-333333333304', 'Master Bath',
   'Marble Look 600x600 Matte — Bianco · Floor', 'TL 05510', 'v-tl05510', 'sqft', 69, 69, 69, 69, 168.00,
   'installed', 'Material Depot', 'ENQ2026072884321', current_date - 24, current_date - 22, null),
  ('88888888-8888-4888-8888-888888880111', '22222222-2222-4222-8222-222222222201', '77777777-7777-4777-8777-777777770111', '33333333-3333-4333-8333-333333333304', 'Master Bath',
   'Brown Glossy Finish 6ft x 4ft Glazed Vitrified · Lower Half Wall', 'TL 03538', 'v-tl03538', 'sqft', 118, 118, 118, 118, 192.00,
   'installed', 'Material Depot', 'ENQ2026072884321', current_date - 24, current_date - 22, null),
  ('88888888-8888-4888-8888-888888880112', '22222222-2222-4222-8222-222222222201', '77777777-7777-4777-8777-777777770112', '33333333-3333-4333-8333-333333333304', 'Master Bath',
   'Subway Matte Finish Glacier White · Upper Half Wall', 'TL 04961 G', 'v-tl04961g', 'sqft', 108, 108, 108, 90, 96.00,
   'installed', 'Material Depot', 'ENQ2026072884321', current_date - 24, current_date - 22, 'Last 18 sqft held back for the niche detail.'),
  ('88888888-8888-4888-8888-888888880113', '22222222-2222-4222-8222-222222222201', '77777777-7777-4777-8777-777777770113', '33333333-3333-4333-8333-333333333304', 'Master Bath',
   'Moroccan Pattern Highlighter 200x200 · Highlighter', 'TL 07731', 'v-tl07731', 'sqft', 26, 26, 26, 26, 245.00,
   'installed', 'Material Depot', 'ENQ2026072884321', current_date - 24, current_date - 22, null),
  ('88888888-8888-4888-8888-888888880114', '22222222-2222-4222-8222-222222222201', '77777777-7777-4777-8777-777777770114', '33333333-3333-4333-8333-333333333304', 'Master Bath',
   'Engineered Quartz Calacatta 20mm · Countertop', 'QZ 8840', 'v-qz8840', 'sqft', 13, 13, 0, 0, 640.00,
   'dispatched', 'Material Depot', 'ENQ2026080691204', current_date + 2, null, null),
  ('88888888-8888-4888-8888-888888880115', '22222222-2222-4222-8222-222222222201', '77777777-7777-4777-8777-777777770115', '33333333-3333-4333-8333-333333333304', 'Master Bath',
   'Linear Shower Drain 600mm Brushed Brass · Shower Area', 'SN 2204', 'v-sn2204', 'nos', 1, 1, 1, 1, 8450.00,
   'installed', 'Material Depot', 'ENQ2026072884321', current_date - 24, current_date - 22, null),
  ('88888888-8888-4888-8888-888888880116', '22222222-2222-4222-8222-222222222201', '77777777-7777-4777-8777-777777770116', '33333333-3333-4333-8333-333333333306', 'Master Bedroom',
   'Engineered Oak Plank 14mm Natural · Floor', 'WF 4420', 'v-wf4420', 'box', 11, 11, 0, 0, 4850.00,
   'ordered', 'Material Depot', 'ENQ2026080691204', current_date + 9, null, 'Acclimatising at the warehouse for 48h before dispatch.'),
  ('88888888-8888-4888-8888-888888880117', '22222222-2222-4222-8222-222222222201', '77777777-7777-4777-8777-777777770117', '33333333-3333-4333-8333-333333333306', 'Master Bedroom',
   'Textured Linen Wallpaper — Oat · Headboard Wall', 'WP 6612', 'v-wp6612', 'roll', 2, 0, 0, 0, 4200.00,
   'pending', 'Material Depot', null, current_date + 20, null, null),
  -- Café: nearly done, which is what puts the project in 'execution'
  ('88888888-8888-4888-8888-888888880301', '22222222-2222-4222-8222-222222222203', '77777777-7777-4777-8777-777777770301', '33333333-3333-4333-8333-333333333321', 'Seating Floor',
   'Vibrant Terrazo Carving Matte Finish 600x1200 · Floor', 'TL 01103', 'v-tl01103', 'sqft', 1029, 1029, 1029, 1029, 128.00,
   'installed', 'Material Depot', 'ENQ2026060471183', current_date - 96, current_date - 94, null),
  ('88888888-8888-4888-8888-888888880302', '22222222-2222-4222-8222-222222222203', '77777777-7777-4777-8777-777777770302', '33333333-3333-4333-8333-333333333322', 'Back Kitchen',
   'Anti-Skid Vitrified 600x600 Matte — Grey · Floor', 'TL 06622', 'v-tl06622', 'box', 18, 18, 18, 18, 1180.00,
   'installed', 'Material Depot', 'ENQ2026060471183', current_date - 96, current_date - 94, null),
  ('88888888-8888-4888-8888-888888880303', '22222222-2222-4222-8222-222222222203', '77777777-7777-4777-8777-777777770303', '33333333-3333-4333-8333-333333333323', 'Washroom',
   'Subway Matte Finish Glacier White · Lower Half Wall', 'TL 04961 G', 'v-tl04961g', 'sqft', 231, 231, 231, 231, 96.00,
   'installed', 'Material Depot', 'ENQ2026060471183', current_date - 96, current_date - 94, null),
  ('88888888-8888-4888-8888-888888880304', '22222222-2222-4222-8222-222222222203', '77777777-7777-4777-8777-777777770304', '33333333-3333-4333-8333-333333333324', 'Shopfront',
   'WPC Louver Charcoal 40x25mm · Facade', 'LV 2240', 'v-lv2240', 'sqft', 357, 357, 357, 210, 268.00,
   'installed', 'Material Depot', 'ENQ2026060471183', current_date - 40, current_date - 36, 'Shopfront going up this week.')
on conflict (id) do update set
  qty_required = excluded.qty_required, qty_ordered = excluded.qty_ordered,
  qty_delivered = excluded.qty_delivered, qty_installed = excluded.qty_installed,
  rate = excluded.rate, status = excluded.status, md_enq_id = excluded.md_enq_id,
  expected_on = excluded.expected_on, delivered_on = excluded.delivered_on, notes = excluded.notes;

-- ------------------------------------------------------------- 9. the money
-- The material figures tie back to quote v2 on purpose: 2,74,200 + 1,82,800 is
-- the ₹4,57,000 the client accepted, and the 4,08,477 cost is what Material
-- Depot bills. The gap between them is the markup, showing up as real money.
insert into finance_entry (id, project_id, direction, category, description, amount, entry_date,
                           settled, counterparty, reference) values
  -- Sharma Residence
  ('99999999-9999-4999-8999-999999990101', '22222222-2222-4222-8222-222222222201', 'income', 'Design fee',
   'Design fee — 50% on signing', 175000, current_date - 160, true, 'Sharma Family', 'INV/ST/2026/041'),
  ('99999999-9999-4999-8999-999999990102', '22222222-2222-4222-8222-222222222201', 'income', 'Design fee',
   'Design fee — 30% on drawings issued', 105000, current_date - 74, true, 'Sharma Family', 'INV/ST/2026/058'),
  ('99999999-9999-4999-8999-999999990103', '22222222-2222-4222-8222-222222222201', 'income', 'Client milestone',
   'Material advance — 60% of quote v2', 274200, current_date - 27, true, 'Sharma Family', 'INV/ST/2026/071'),
  ('99999999-9999-4999-8999-999999990104', '22222222-2222-4222-8222-222222222201', 'income', 'Client milestone',
   'Material balance — 40% of quote v2', 182800, current_date - 5, false, 'Sharma Family', 'INV/ST/2026/079'),
  ('99999999-9999-4999-8999-999999990105', '22222222-2222-4222-8222-222222222201', 'income', 'Supervision fee',
   'Site supervision — 4 months', 90000, current_date - 5, false, 'Sharma Family', 'INV/ST/2026/080'),
  ('99999999-9999-4999-8999-999999990111', '22222222-2222-4222-8222-222222222201', 'cost', 'Material',
   'Material Depot — quote v2 supply', 408477, current_date - 26, false, 'Material Depot', 'ENQ2026072884321'),
  ('99999999-9999-4999-8999-999999990112', '22222222-2222-4222-8222-222222222201', 'cost', 'Labour',
   'Tiling contractor — living, dining, baths', 96000, current_date - 19, true, 'Rafiq Tiling Works', 'CASH/09'),
  ('99999999-9999-4999-8999-999999990113', '22222222-2222-4222-8222-222222222201', 'cost', 'Labour',
   'Carpentry — louver panel and wardrobe carcass', 74000, current_date - 3, false, 'Sathish Interiors', null),
  ('99999999-9999-4999-8999-999999990114', '22222222-2222-4222-8222-222222222201', 'cost', 'Transport',
   'Unloading and lift charges, two deliveries', 18500, current_date - 21, true, 'Site', null),
  ('99999999-9999-4999-8999-999999990115', '22222222-2222-4222-8222-222222222201', 'cost', 'Site expenses',
   'Water, power, consumables', 12400, current_date - 14, true, 'Site', null),
  -- Café
  ('99999999-9999-4999-8999-999999990301', '22222222-2222-4222-8222-222222222203', 'income', 'Design fee',
   'Design fee — full', 240000, current_date - 140, true, 'Anand Prakash', 'INV/ST/2026/031'),
  ('99999999-9999-4999-8999-999999990302', '22222222-2222-4222-8222-222222222203', 'income', 'Client milestone',
   'Material — quote v1, full', 324965, current_date - 112, true, 'Anand Prakash', 'INV/ST/2026/034'),
  ('99999999-9999-4999-8999-999999990303', '22222222-2222-4222-8222-222222222203', 'cost', 'Material',
   'Material Depot — quote v1 supply', 270804, current_date - 110, true, 'Material Depot', 'ENQ2026060471183'),
  ('99999999-9999-4999-8999-999999990304', '22222222-2222-4222-8222-222222222203', 'cost', 'Labour',
   'Tiling and shopfront fabrication', 186000, current_date - 60, true, 'Rafiq Tiling Works', null),
  ('99999999-9999-4999-8999-999999990305', '22222222-2222-4222-8222-222222222203', 'cost', 'Contractor',
   'Shopfront installation — balance due', 42000, current_date - 6, false, 'Sathish Interiors', null)
on conflict (id) do update set
  direction = excluded.direction, category = excluded.category, description = excluded.description,
  amount = excluded.amount, entry_date = excluded.entry_date, settled = excluded.settled,
  counterparty = excluded.counterparty, reference = excluded.reference;

-- --------------------------------------------------------- 10. referrals
insert into referral (id, partner_id, client_id, project_id, client_name, md_phone, referred_on, notes) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', '0d0d0d0d-0000-4000-8000-000000000001',
   '11111111-1111-4111-8111-111111111101', '22222222-2222-4222-8222-222222222201',
   'Sharma Family', '9845112233', current_date - 45, 'Sent them to Whitefield to see the Breccia slab in person.'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02', '0d0d0d0d-0000-4000-8000-000000000001',
   '11111111-1111-4111-8111-111111111102', '22222222-2222-4222-8222-222222222202',
   'Nikhil & Priya Rao', '9880223344', current_date - 20, 'Still comparing oak finishes. Priya wants to feel the samples.'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03', '0d0d0d0d-0000-4000-8000-000000000001',
   '11111111-1111-4111-8111-111111111103', '22222222-2222-4222-8222-222222222203',
   'Anand Prakash', '9740334455', current_date - 104, 'Commercial rates discussed at the store.'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04', '0d0d0d0d-0000-4000-8000-000000000001',
   '11111111-1111-4111-8111-111111111104', null,
   'Kavya Iyer', '9663445566', current_date - 8, 'Just introduced. Brief still forming.')
on conflict (id) do update set
  client_name = excluded.client_name, md_phone = excluded.md_phone,
  client_id = excluded.client_id, project_id = excluded.project_id,
  referred_on = excluded.referred_on, notes = excluded.notes;

-- What each referred client actually did with us. In production these rows are
-- written ONLY by /api/sync/referrals with the service-role key, deduplicated on
-- external_id — the app's own policies make them read-only to a partner.
insert into referral_event (id, referral_id, event_type, occurred_at, store, title, detail, amount, payload, external_id) values
  -- Sharma: first visit, browsed, carted, ordered
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', 'store_visit',
   current_date - 42 + interval '13 hours', 'Whitefield', 'Walk-in with the architect',
   'Two hours in the large-format slab bay.', null, '{"advisor":"Sandeep K"}', 'demo:visit:sharma:1'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', 'product_view',
   current_date - 42 + interval '13 hours 25 minutes', 'Whitefield',
   'Royal Breccia 1800x1200 mm Glossy Finish', 'TL 03547 · viewed a full slab', null,
   '{"sku":"TL 03547"}', 'demo:view:sharma:1'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb03', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', 'product_view',
   current_date - 42 + interval '13 hours 50 minutes', 'Whitefield',
   'Brown Glossy Finish 6ft x 4ft Glazed Vitrified', 'TL 03538 · took a sample home', null,
   '{"sku":"TL 03538"}', 'demo:view:sharma:2'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb04', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', 'cart_add',
   current_date - 42 + interval '14 hours 40 minutes', 'Whitefield', 'Cart created — 6 items',
   'Breccia floor, brown glossy, subway, highlighter, quartz, shower drain', 346727,
   '{"items":6}', 'demo:cart:sharma:1'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb05', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', 'quote_shared',
   current_date - 34 + interval '11 hours 15 minutes', 'Whitefield', 'Material Depot quote shared',
   'Commercial rates applied on the slab line.', 384500, '{}', 'demo:quote:sharma:1'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb06', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', 'order_placed',
   current_date - 30 + interval '16 hours 5 minutes', 'Whitefield', 'Order placed — ENQ2026072884321',
   'Living, dining and master bath, full supply.', 384500, '{"enq":"ENQ2026072884321"}', 'demo:order:sharma:1'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb07', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', 'store_visit',
   current_date - 12 + interval '17 hours 30 minutes', 'Whitefield', 'Second visit',
   'Came back for the kitchen and bedroom selections.', null, '{"advisor":"Sandeep K"}', 'demo:visit:sharma:2'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb08', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', 'cart_add',
   current_date - 11 + interval '10 hours 20 minutes', 'Whitefield', 'Cart updated — 4 items',
   'Anti-skid, quartz, oak plank, terrazzo feature', 142000, '{"items":4}', 'demo:cart:sharma:2'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb09', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', 'order_placed',
   current_date - 9 + interval '12 hours 45 minutes', 'Whitefield', 'Order placed — ENQ2026080691204',
   'Kitchen and bedroom supply.', 142000, '{"enq":"ENQ2026080691204"}', 'demo:order:sharma:2'),

  -- Rao: interested, carted, has not ordered. This is the state that should
  -- make an architect pick up the phone.
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb11', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02', 'store_visit',
   current_date - 16 + interval '18 hours 40 minutes', 'Indiranagar', 'Walk-in, evening',
   'Spent most of it in the wooden flooring aisle.', null, '{"advisor":"Meghana R"}', 'demo:visit:rao:1'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb12', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02', 'product_view',
   current_date - 16 + interval '19 hours', 'Indiranagar', 'Engineered Oak Plank 14mm Light',
   'WF 4402 · compared against the Natural', null, '{"sku":"WF 4402"}', 'demo:view:rao:1'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb13', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02', 'product_view',
   current_date - 16 + interval '19 hours 20 minutes', 'Indiranagar', 'Acrylic Laminate Arctic White Matte 1mm',
   'LM 3301 · for the kitchen shutters', null, '{"sku":"LM 3301"}', 'demo:view:rao:2'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb14', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02', 'cart_add',
   current_date - 15 + interval '9 hours 10 minutes', 'Indiranagar', 'Cart created — 3 items',
   'Oak plank, arctic white laminate, quartz. Not ordered yet.', 78400, '{"items":3}', 'demo:cart:rao:1'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb15', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02', 'call',
   current_date - 6 + interval '15 hours', null, 'Follow-up call',
   'Asked for a sample box to be couriered.', null, '{}', 'demo:call:rao:1'),

  -- Prakash: one visit, one order, done
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb21', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03', 'store_visit',
   current_date - 100 + interval '11 hours 30 minutes', 'Sarjapur', 'Walk-in — commercial enquiry',
   'Needed anti-skid certification for the licence file.', null, '{"advisor":"Praveen M"}', 'demo:visit:prakash:1'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb22', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03', 'order_placed',
   current_date - 97 + interval '14 hours', 'Sarjapur', 'Order placed — ENQ2026060471183',
   'Café floor, back kitchen, washroom and shopfront.', 96000, '{"enq":"ENQ2026060471183"}', 'demo:order:prakash:1'),

  -- Iyer: just introduced
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb31', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04', 'store_visit',
   current_date - 6 + interval '12 hours 15 minutes', 'Jayanagar', 'First visit',
   'Browsing only. Brief not finalised.', null, '{"advisor":"Divya S"}', 'demo:visit:iyer:1'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb32', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04', 'product_view',
   current_date - 6 + interval '12 hours 40 minutes', 'Jayanagar', 'Vibrant Terrazo Carving Matte Finish 600x1200',
   'TL 01103 · liked it for the staircase', null, '{"sku":"TL 01103"}', 'demo:view:iyer:1')
on conflict (id) do update set
  event_type = excluded.event_type, occurred_at = excluded.occurred_at, store = excluded.store,
  title = excluded.title, detail = excluded.detail, amount = excluded.amount,
  payload = excluded.payload, external_id = excluded.external_id;

-- The orders. `md_enq_id` is unique, which is what makes the reward total
-- idempotent — re-running this file cannot inflate it.
insert into referral_order (id, referral_id, md_enq_id, order_value, ordered_on, store, status) values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccc01', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', 'ENQ2026072884321',
   384500, current_date - 30, 'Whitefield', 'Delivered'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccc02', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', 'ENQ2026080691204',
   142000, current_date - 9, 'Whitefield', 'Partially delivered'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccc03', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03', 'ENQ2026060471183',
   96000, current_date - 97, 'Sarjapur', 'Delivered')
on conflict (id) do update set
  md_enq_id = excluded.md_enq_id, order_value = excluded.order_value,
  ordered_on = excluded.ordered_on, store = excluded.store, status = excluded.status;

-- ----------------------------------------------------------- 11. rewards
-- ₹6,22,500 attributed, so tiers 1, 2 and 3 are earned and the next one is the
-- 3 GM gold coin at ₹10 L — ₹3,77,500 away. These rows record only that the
-- tiers were REACHED and where the handover got to; whether a tier is unlocked
-- is derived from referral_order every time it is displayed.
insert into reward_claim (id, partner_id, tier_id, status, unlocked_at, fulfilled_on, notes) values
  ('dddddddd-dddd-4ddd-8ddd-dddddddddd01', '0d0d0d0d-0000-4000-8000-000000000001', 1, 'fulfilled',
   now() - interval '30 days', current_date - 21, 'Handed over at the Whitefield store.'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddd02', '0d0d0d0d-0000-4000-8000-000000000001', 2, 'claimed',
   now() - interval '30 days', null, 'Claimed — courier arranged.'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddd03', '0d0d0d0d-0000-4000-8000-000000000001', 3, 'unlocked',
   now() - interval '9 days', null, null)
on conflict (partner_id, tier_id) do update set
  status = excluded.status, unlocked_at = excluded.unlocked_at,
  fulfilled_on = excluded.fulfilled_on, notes = excluded.notes;

-- ============================================================================
-- Sanity check — run this after, it should print the figures the app shows.
-- ============================================================================
select
  (select count(*) from client)                                        as clients,
  (select count(*) from project)                                       as projects,
  (select count(*) from project_area)                                  as rooms,
  (select count(*) from board)                                         as boards,
  (select count(*) from board_item)                                    as board_products,
  (select count(*) from quote_line)                                    as quote_lines,
  (select count(*) from procurement_item)                              as procurement_lines,
  (select count(*) from finance_entry)                                 as ledger_entries,
  (select count(*) from referral)                                      as referrals,
  (select count(*) from referral_event)                                as referral_events,
  (select coalesce(sum(order_value), 0) from referral_order)           as attributed_sale,
  (select count(*) from reward_tier
     where threshold <= (select coalesce(sum(order_value), 0) from referral_order)) as tiers_earned;

-- ============================================================================
-- TEARDOWN, when you want the real data in instead. Deletes cascade from
-- partner, so this is the whole lot in one line — the reward TIERS survive,
-- since those are the scheme itself, not demo data.
--
--   delete from partner where id = '0d0d0d0d-0000-4000-8000-000000000001';
--
-- That also unlinks the demo login. To remove it entirely, delete
-- demo.studio@materialdepot.com from Authentication → Users.
-- ============================================================================

-- The auth user the seed attaches the demo firm to. On the real project this
-- row is created by signing up through the app; here it is faked so the seed
-- can be tested without GoTrue.
insert into auth.users (id, email) values
  ('8bd4f092-ebf4-4c6c-b6f3-0e077d93ebda', 'demo.studio@materialdepot.com')
on conflict (email) do nothing;

-- The demo STAFF logins. Same fiction as the partner one above: in the real
-- project these are created by GoTrue (Authentication → Users, or the console's
-- own provisioning route), not by an insert. seed/002_console.sql attaches a
-- staff_user row to each of these by email and skips any that are missing, so
-- creating them here is what lets the console seed be exercised at all.
insert into auth.users (id, email) values
  ('5ca1ab1e-0000-4000-8000-000000000001', 'demo.admin@materialdepot.com'),
  ('5ca1ab1e-0000-4000-8000-000000000002', 'demo.kam.blr@materialdepot.com'),
  ('5ca1ab1e-0000-4000-8000-000000000003', 'demo.kam.hyd@materialdepot.com'),
  ('5ca1ab1e-0000-4000-8000-000000000004', 'demo.outreach.blr@materialdepot.com'),
  ('5ca1ab1e-0000-4000-8000-000000000005', 'demo.outreach.hyd@materialdepot.com'),
  ('5ca1ab1e-0000-4000-8000-000000000006', 'demo.inbound@materialdepot.com')
on conflict (email) do nothing;

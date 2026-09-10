-- The auth user the seed attaches the demo firm to. On the real project this
-- row is created by signing up through the app; here it is faked so the seed
-- can be tested without GoTrue.
insert into auth.users (id, email) values
  ('8bd4f092-ebf4-4c6c-b6f3-0e077d93ebda', 'demo.studio@materialdepot.com')
on conflict (email) do nothing;

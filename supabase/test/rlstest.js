const { Client } = require('pg')

const DEMO_UID = '8bd4f092-ebf4-4c6c-b6f3-0e077d93ebda'
const OTHER_UID = '11111111-2222-3333-4444-555555555555'
const TABLES = ['client','project','project_area','board','board_item','quote','quote_line',
                'procurement_item','finance_entry','referral','referral_event','referral_order','reward_claim']

let pass = 0, fail = 0
const check = (name, ok, extra = '') => {
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${extra ? ' — ' + extra : ''}`)
  ok ? pass++ : fail++
}

async function asUser(c, uid, fn) {
  await c.query('begin')
  await c.query(`set local role authenticated`)
  await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid])
  try { return await fn() } finally { await c.query('rollback') }
}

;(async () => {
  const c = new Client({ host: '127.0.0.1', port: 54329, user: 'postgres', database: 'postgres' })
  await c.connect()

  // A second firm with its own login, so "another architect" is a real row.
  await c.query(`insert into auth.users (id, email) values ($1,'rival@example.in') on conflict do nothing`, [OTHER_UID])
  await c.query(`insert into partner (id, firm_name, contact_name, phone, city)
                 values ('0d0d0d0d-0000-4000-8000-000000000002','Rival Design Co','Someone Else','9900011122','Bengaluru')
                 on conflict (id) do nothing`)
  await c.query(`insert into partner_user (user_id, partner_id) values ($1,'0d0d0d0d-0000-4000-8000-000000000002')
                 on conflict (user_id) do nothing`, [OTHER_UID])
  await c.query(`insert into client (partner_id, name, phone)
                 values ('0d0d0d0d-0000-4000-8000-000000000002','Rival Client','9911122233')
                 on conflict do nothing`)

  console.log('\n1. The demo partner sees their own data')
  await asUser(c, DEMO_UID, async () => {
    for (const t of TABLES) {
      const { rows } = await c.query(`select count(*)::int n from ${t}`)
      check(`${t} visible`, rows[0].n > 0, `${rows[0].n} rows`)
    }
  })

  console.log('\n2. Another architect sees NONE of it (the whole point)')
  await asUser(c, OTHER_UID, async () => {
    for (const t of TABLES) {
      const { rows } = await c.query(`select count(*)::int n from ${t}`)
      // client is the one table the rival legitimately has a row in.
      const expected = t === 'client' ? 1 : 0
      check(`${t} leaks nothing`, rows[0].n === expected, `${rows[0].n} rows (expected ${expected})`)
    }
    const { rows: leak } = await c.query(`select count(*)::int n from client where name = 'Sharma Family'`)
    check(`cannot see the other firm's client by name`, leak[0].n === 0)
  })

  console.log('\n3. Signed out (anon) sees nothing at all')
  await c.query('begin'); await c.query('set local role anon')
  for (const t of [...TABLES, 'partner', 'reward_tier']) {
    const { rows } = await c.query(`select count(*)::int n from ${t}`)
    check(`${t} closed to anon`, rows[0].n === 0, `${rows[0].n} rows`)
  }
  await c.query('rollback')

  console.log('\n4. A partner cannot forge the rows their payout is computed from')
  await asUser(c, DEMO_UID, async () => {
    const refId = (await c.query(`select id from referral limit 1`)).rows[0].id
    for (const [t, sql, params] of [
      ['referral_order', `insert into referral_order (referral_id, md_enq_id, order_value) values ($1,'FORGED',9999999)`, [refId]],
      ['referral_event', `insert into referral_event (referral_id, event_type, occurred_at, external_id) values ($1,'order_placed',now(),'forged')`, [refId]],
      ['reward_claim',   `insert into reward_claim (partner_id, tier_id) values ('0d0d0d0d-0000-4000-8000-000000000001',6)`, []],
    ]) {
      await c.query('savepoint sp')
      try { await c.query(sql, params); check(`${t} insert blocked`, false, 'IT WENT THROUGH') }
      catch (e) { check(`${t} insert blocked`, e.code === '42501', e.code) }
      await c.query('rollback to savepoint sp')
    }
  })

  console.log('\n5. A partner cannot join a firm by guessing its id')
  await asUser(c, OTHER_UID, async () => {
    try {
      await c.query(`insert into partner_user (user_id, partner_id) values ($1,'0d0d0d0d-0000-4000-8000-000000000001')`, [OTHER_UID])
      check('partner_user insert blocked', false, 'IT WENT THROUGH')
    } catch (e) { check('partner_user insert blocked', e.code === '42501', e.code) }
  })

  console.log('\n6. onboard_partner')
  const NEW_UID = '99999999-8888-7777-6666-555555555555'
  await c.query(`insert into auth.users (id, email) values ($1,'fresh@example.in') on conflict do nothing`, [NEW_UID])
  await asUser(c, NEW_UID, async () => {
    const { rows } = await c.query(`select onboard_partner('Fresh Studio','A Person','+91 98450 99887','fresh@example.in','Mysuru','architect',null) id`)
    check('creates a firm and links the caller', Boolean(rows[0].id))
    const { rows: p } = await c.query(`select phone from partner where id = $1`, [rows[0].id])
    check('normalises +91 98450 99887 to 10 digits', p[0].phone === '9845099887', p[0].phone)
    await c.query('savepoint sp')
    try { await c.query(`select onboard_partner('Again','X','9845099888',null,null,'architect',null)`); check('refuses a second firm for one login', false, 'IT WENT THROUGH') }
    catch (e) { check('refuses a second firm for one login', /already belongs/.test(e.message), e.message.slice(0, 60)) }
    await c.query('rollback to savepoint sp')
  })
  await asUser(c, NEW_UID, async () => {
    await c.query('savepoint sp')
    try { await c.query(`select onboard_partner('Copycat','Y','9845012345',null,null,'architect',null)`); check('refuses a phone another firm already uses', false, 'IT WENT THROUGH') }
    catch (e) { check('refuses a phone another firm already uses', /already registered/.test(e.message) || /already belongs/.test(e.message), e.message.slice(0, 70)) }
    await c.query('rollback to savepoint sp')
    await c.query('savepoint sp2')
    try { await c.query(`select onboard_partner('Bad Phone','Z','12345',null,null,'architect',null)`); check('refuses a non-mobile number', false, 'IT WENT THROUGH') }
    catch (e) { check('refuses a non-mobile number', /10-digit/.test(e.message), e.message.slice(0, 60)) }
    await c.query('rollback to savepoint sp2')
  })

  console.log(`\n${pass} passed, ${fail} failed`)
  await c.end()
  process.exit(fail ? 1 : 0)
})()

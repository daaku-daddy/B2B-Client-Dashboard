const { Client } = require('pg')
const fs = require('fs')

const files = process.argv.slice(2)
;(async () => {
  const c = new Client({ host: '127.0.0.1', port: 54329, user: 'postgres', database: 'postgres' })
  await c.connect()
  for (const f of files) {
    const sql = fs.readFileSync(f, 'utf8')
    try {
      const res = await c.query(sql)
      const results = Array.isArray(res) ? res : [res]
      const rows = results.filter(r => r.rows && r.rows.length)
      console.log(`OK   ${f}`)
      for (const r of rows) console.log('     ', JSON.stringify(r.rows[0]))
    } catch (e) {
      console.log(`FAIL ${f}`)
      console.log(`      ${e.code || ''} ${e.message}`)
      if (e.position) {
        const upto = sql.slice(0, Number(e.position))
        console.log(`      at line ${upto.split('\n').length}: ${sql.split('\n')[upto.split('\n').length - 1]?.trim().slice(0, 120)}`)
      }
      if (e.hint) console.log(`      hint: ${e.hint}`)
      if (e.detail) console.log(`      detail: ${e.detail}`)
      await c.end()
      process.exit(1)
    }
  }
  await c.end()
})()

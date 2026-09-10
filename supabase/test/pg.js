// Starts / stops a throwaway Postgres 18 in ./data, TCP only on 54329.
//
// Unix sockets are deliberately off: the socket path under a scratch directory
// blows past the ~100 char limit and Postgres refuses to start with
// "could not create any Unix-domain sockets", which reads like a permissions
// problem and is not.
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const BIN = path.join(__dirname, 'node_modules/@embedded-postgres/darwin-arm64/native/bin')
const DATA = path.join(__dirname, 'data')
const cmd = process.argv[2]

const pg_ctl = (...args) => execFileSync(path.join(BIN, 'pg_ctl'), args, { stdio: 'inherit' })

if (cmd === 'start') {
  if (!fs.existsSync(DATA)) {
    execFileSync(path.join(BIN, 'initdb'), ['-D', DATA, '-U', 'postgres', '--auth=trust'], { stdio: 'inherit' })
    fs.appendFileSync(path.join(DATA, 'postgresql.conf'),
      "\nunix_socket_directories = ''\nlisten_addresses = '127.0.0.1'\nport = 54329\n")
  }
  pg_ctl('-D', DATA, '-l', path.join(__dirname, 'pg.log'), '-w', 'start')
} else if (cmd === 'stop') {
  pg_ctl('-D', DATA, '-m', 'fast', 'stop')
} else {
  console.error('usage: node pg.js start|stop')
  process.exit(1)
}

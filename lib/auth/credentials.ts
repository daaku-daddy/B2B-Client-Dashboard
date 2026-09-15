import { randomInt } from 'node:crypto'

/**
 * Characters that cannot be misread off a screen or a printed slip. No `I`,
 * `l`, `1`, `O` or `0` — these passwords are read out on a call or typed off a
 * WhatsApp message by someone who has never seen this app, and "was that an ell
 * or a one" is a support ticket.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

/**
 * A one-time password for a newly provisioned login.
 *
 * `randomInt` from `node:crypto`, not `Math.random` — this is a credential.
 * Grouped into fours so it can be read aloud.
 *
 * It is generated, shown to the admin ONCE and never stored: Supabase keeps only
 * the hash, and nothing in this repo writes the plaintext to a table, a log or a
 * revalidated page. If it is lost, the admin issues a new one; there is no way
 * to look the old one up, which is the point.
 */
export function generatePassword(groups = 4, size = 4): string {
  const out: string[] = []
  for (let g = 0; g < groups; g++) {
    let s = ''
    for (let i = 0; i < size; i++) s += ALPHABET[randomInt(ALPHABET.length)]
    out.push(s)
  }
  return out.join('-')
}

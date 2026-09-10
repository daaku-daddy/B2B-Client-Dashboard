/**
 * Every read and write in this app returns one of these. A caller cannot
 * accidentally treat a failure as "no rows" — the two are different shapes.
 *
 * This exists because the opposite convention (return `[]` on error) has cost
 * Material Depot real bugs: a roster that failed to load rendered as "no staff"
 * and stayed that way, and a query error rendered as an empty dashboard that
 * nobody could tell from a quiet day.
 */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

export const ok = <T>(data: T): Result<T> => ({ ok: true, data })
export const fail = (error: string): Result<never> => ({ ok: false, error })

export function unwrapOr<T>(r: Result<T>, fallback: T): T {
  return r.ok ? r.data : fallback
}

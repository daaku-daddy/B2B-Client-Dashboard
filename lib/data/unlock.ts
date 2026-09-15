import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Record the reward tiers a partner has just crossed.
 *
 * Whether a tier is unlocked is DERIVED from the orders everywhere it is shown.
 * This only records the moment it happened, so a partner can be told "you earned
 * this on the 9th" and so a handover has a row to hang off. It never deletes a
 * claim: a corrected order value that drops a partner back below a threshold
 * does not un-give a gold coin.
 *
 * **Only APPROVED orders count.** That is the one line in this file that has to
 * stay right. Before the approval gate existed this summed every order the sync
 * had ever written, which meant an order attributed to the wrong architect
 * unlocked a tier for them the moment it arrived — and a claim, once written, is
 * never deleted. Now a tier can only be crossed by an order a person has looked
 * at, which is why this runs on approval as well as on sync.
 *
 * Returns only the tiers crossed by THIS call, never everything due. The first
 * version reported everything due and a nightly sync congratulated partners for
 * a coin they got in July, every night.
 */
export async function recordUnlockedTiers(
  db: SupabaseClient,
  partnerIds: string[],
): Promise<{ partner_id: string; tier_id: number }[]> {
  if (!partnerIds.length) return []

  const { data: tiers } = await db.from('reward_tier').select('id, threshold').eq('active', true)
  if (!tiers?.length) return []

  const out: { partner_id: string; tier_id: number }[] = []
  for (const partnerId of partnerIds) {
    const { data: refs } = await db.from('referral').select('id').eq('partner_id', partnerId)
    const ids = (refs ?? []).map((r) => r.id)
    if (!ids.length) continue

    const { data: ords } = await db
      .from('referral_order')
      .select('order_value')
      .in('referral_id', ids)
      .eq('approval_status', 'approved')
    const total = (ords ?? []).reduce((s, o) => s + (Number(o.order_value) || 0), 0)

    const due = tiers.filter((t) => total >= Number(t.threshold))
    if (!due.length) continue

    const { data: already, error: readErr } = await db
      .from('reward_claim')
      .select('tier_id')
      .eq('partner_id', partnerId)
    if (readErr) continue
    const have = new Set((already ?? []).map((r) => r.tier_id as number))
    const fresh = due.filter((t) => !have.has(t.id))
    if (!fresh.length) continue

    const { error } = await db
      .from('reward_claim')
      .insert(fresh.map((t) => ({ partner_id: partnerId, tier_id: t.id, status: 'unlocked' as const })))
    if (!error) fresh.forEach((t) => out.push({ partner_id: partnerId, tier_id: t.id }))
  }
  return out
}

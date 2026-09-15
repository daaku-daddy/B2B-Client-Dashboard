import { Badge, type Tone } from '@/components/ui'
import type { OrderApproval } from '@/lib/domain/types'

/**
 * How an order's verification state reads TO THE PARTNER.
 *
 * Deliberately not "pending approval" — a designer reading that about their own
 * client's real order hears "we might not pay you". What is actually happening
 * is a check on our side, and saying so is both true and the difference between
 * a partner waiting patiently and a partner ringing their KAM.
 */
export const ORDER_APPROVAL: Record<OrderApproval, { label: string; tone: Tone; blurb: string }> = {
  approved: {
    label: 'Counted',
    tone: 'good',
    blurb: 'Verified by Material Depot and counting towards your rewards.',
  },
  pending: {
    label: 'Being checked',
    tone: 'warn',
    blurb: 'We are confirming this one before it counts. Usually a day or two.',
  },
  rejected: {
    label: 'Not counted',
    tone: 'bad',
    blurb: 'This one is not being counted towards your rewards — your KAM can tell you why.',
  },
}

export function OrderApprovalBadge({ status }: { status: OrderApproval }) {
  const s = ORDER_APPROVAL[status] ?? ORDER_APPROVAL.pending
  return <Badge tone={s.tone} title={s.blurb}>{s.label}</Badge>
}

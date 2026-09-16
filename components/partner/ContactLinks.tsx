'use client'

import { Mail, MessageCircle, Phone } from 'lucide-react'
import { EV, track } from '@/lib/analytics/track'

/**
 * §8.2.5's contact row — phone (click-to-call), WhatsApp deep link, email.
 *
 * A client component only because §14.6.4 wants `kam_contact_clicked` with a
 * `channel` property: which way partners actually reach their KAM is the one
 * thing that decides whether the WhatsApp integration in §14.3 is worth
 * building, and it cannot be answered from server logs.
 */
export function ContactLinks({ phone, email }: { phone: string | null; email: string | null }) {
  const wa = phone ? `https://wa.me/91${phone.replace(/\D/g, '').slice(-10)}` : null
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {phone ? (
        <a
          href={`tel:${phone}`}
          onClick={() => track(EV.kam_contact_clicked, { channel: 'call' })}
          className="inline-flex items-center gap-1.5 text-brand hover:underline"
        >
          <Phone size={13} /> {phone}
        </a>
      ) : null}
      {wa ? (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track(EV.kam_contact_clicked, { channel: 'whatsapp' })}
          className="inline-flex items-center gap-1.5 text-brand hover:underline"
        >
          <MessageCircle size={13} /> WhatsApp
        </a>
      ) : null}
      {email ? (
        <a
          href={`mailto:${email}`}
          onClick={() => track(EV.kam_contact_clicked, { channel: 'email' })}
          className="inline-flex items-center gap-1.5 truncate text-brand hover:underline"
        >
          <Mail size={13} /> {email}
        </a>
      ) : null}
    </div>
  )
}

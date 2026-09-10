'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { NAV } from './nav'
import { supabaseBrowser } from '@/lib/supabase/client'
import { cn } from '@/lib/cn'
import type { Partner } from '@/lib/domain/types'

export function Sidebar({ partner, email }: { partner: Partner; email: string | null }) {
  const path = usePathname()
  const router = useRouter()

  async function signOut() {
    await supabaseBrowser().auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  return (
    <aside className="flex w-full shrink-0 flex-col border-line bg-surface md:h-dvh md:w-60 md:border-r">
      <div className="border-b border-line px-4 py-4">
        <p className="font-display text-[15px] leading-tight font-semibold tracking-tight text-ink">
          Material Depot
        </p>
        <p className="text-[11px] font-medium tracking-wide text-brand uppercase">for Partners</p>
      </div>

      <nav className="flex gap-1 overflow-x-auto p-2 md:flex-1 md:flex-col md:overflow-visible">
        {NAV.map((item) => {
          const active = path === item.href || path.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium whitespace-nowrap transition',
                active ? 'bg-brand-soft text-brand' : 'text-ink-soft hover:bg-raised hover:text-ink',
              )}
            >
              <item.icon size={16} strokeWidth={2} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="hidden border-t border-line p-3 md:block">
        <p className="truncate text-xs font-semibold text-ink">{partner.firm_name}</p>
        <p className="truncate text-[11px] text-ink-faint">{email ?? partner.phone}</p>
        <button
          onClick={signOut}
          className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-faint transition hover:text-bad"
        >
          <LogOut size={12} /> Sign out
        </button>
      </div>
    </aside>
  )
}

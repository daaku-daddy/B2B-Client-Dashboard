import type { LucideIcon } from 'lucide-react'
import { Award, Building2, LayoutDashboard, Palette, Users } from 'lucide-react'

export type NavItem = { href: string; label: string; icon: LucideIcon; blurb: string }

export const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, blurb: 'Everything at a glance' },
  { href: '/projects', label: 'Projects', icon: Palette, blurb: 'Design, quote, procure' },
  { href: '/clients', label: 'Clients', icon: Users, blurb: 'Who you are working for' },
  { href: '/referrals', label: 'Referrals', icon: Building2, blurb: 'Clients you sent to us' },
  { href: '/rewards', label: 'Rewards', icon: Award, blurb: 'Your incentive ladder' },
]

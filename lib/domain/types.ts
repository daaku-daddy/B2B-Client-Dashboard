// Row shapes, mirroring supabase/migrations/001_init.sql. If you change a
// column there, change it here in the same commit.

export type FirmType = 'architect' | 'interior_designer' | 'design_build' | 'contractor' | 'other'
export type PartnerRole = 'principal' | 'associate' | 'viewer'

export type Partner = {
  id: string
  firm_name: string
  contact_name: string
  phone: string
  email: string | null
  city: string | null
  gst: string | null
  firm_type: FirmType
  onboarded_on: string
  created_at: string
}

export type Client = {
  id: string
  partner_id: string
  name: string
  phone: string | null
  email: string | null
  city: string | null
  address: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type ProjectStage = 'design' | 'procurement' | 'execution' | 'closed'
export type ProjectStatus = 'active' | 'on_hold' | 'won' | 'lost' | 'closed'

export type Project = {
  id: string
  partner_id: string
  client_id: string
  name: string
  site_address: string | null
  city: string | null
  project_type: 'residential' | 'commercial' | 'hospitality' | 'retail' | 'office' | 'other'
  stage: ProjectStage
  status: ProjectStatus
  carpet_area_sqft: number | null
  budget: number | null
  design_fee: number | null
  started_on: string | null
  target_on: string | null
  closed_on: string | null
  created_at: string
  updated_at: string
}

export type AreaStatus = 'exploring' | 'shortlisted' | 'finalised' | 'dropped'

export type ProjectArea = {
  id: string
  project_id: string
  area_type: string
  name: string
  floor_area_sqft: number | null
  wall_area_sqft: number | null
  status: AreaStatus
  sort_order: number
  notes: string | null
  created_at: string
  updated_at: string
}

export type BoardStatus = 'draft' | 'shared' | 'approved' | 'rejected'

export type Board = {
  id: string
  area_id: string
  name: string
  palette_scene: string | null
  cover_url: string | null
  status: BoardStatus
  approved_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type BoardItem = {
  id: string
  board_id: string
  kind: 'product' | 'image' | 'note'
  surface: string | null
  variant_id: string | null
  sku: string | null
  product_name: string | null
  brand: string | null
  category: string | null
  size: string | null
  finish: string | null
  image_url: string | null
  md_url: string | null
  unit: string | null
  rate: number | null
  mrp: number | null
  gst_pct: number | null
  coverage_area: number | null
  priced_at: string | null
  qty: number | null
  wastage_pct: number
  note: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export type QuoteStatus = 'draft' | 'shared' | 'accepted' | 'rejected' | 'superseded'

export type Quote = {
  id: string
  project_id: string
  version: number
  title: string | null
  status: QuoteStatus
  markup_pct: number
  discount: number
  valid_until: string | null
  shared_at: string | null
  decided_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type QuoteLine = {
  id: string
  quote_id: string
  board_item_id: string | null
  area_id: string | null
  area_label: string | null
  description: string
  sku: string | null
  variant_id: string | null
  qty: number
  unit: string
  rate: number
  gst_pct: number
  line_markup_pct: number | null
  sort_order: number
  created_at: string
}

export type ProcurementStatus =
  | 'pending' | 'ordered' | 'dispatched' | 'delivered' | 'installed' | 'cancelled'

export type ProcurementItem = {
  id: string
  project_id: string
  quote_line_id: string | null
  area_id: string | null
  area_label: string | null
  description: string
  sku: string | null
  variant_id: string | null
  unit: string
  qty_required: number
  qty_ordered: number
  qty_delivered: number
  qty_installed: number
  rate: number
  status: ProcurementStatus
  supplier: string
  md_enq_id: string | null
  expected_on: string | null
  delivered_on: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type FinanceEntry = {
  id: string
  project_id: string
  direction: 'cost' | 'income'
  category: string
  description: string
  amount: number
  entry_date: string
  settled: boolean
  counterparty: string | null
  reference: string | null
  created_at: string
}

export type Referral = {
  id: string
  partner_id: string
  client_id: string | null
  project_id: string | null
  client_name: string
  md_phone: string
  referred_on: string
  notes: string | null
  created_at: string
}

export type ReferralEventType =
  | 'store_visit' | 'product_view' | 'cart_add' | 'quote_shared' | 'order_placed' | 'call' | 'other'

export type ReferralEvent = {
  id: string
  referral_id: string
  event_type: ReferralEventType
  occurred_at: string
  store: string | null
  title: string | null
  detail: string | null
  amount: number | null
  payload: Record<string, unknown>
  external_id: string
  synced_at: string
}

export type ReferralOrder = {
  id: string
  referral_id: string
  md_enq_id: string
  order_value: number
  ordered_on: string | null
  store: string | null
  status: string | null
  synced_at: string
}

export type RewardTier = {
  id: number
  threshold: number
  label: string
  kind: 'silver' | 'gold' | 'trip'
  detail: string | null
  active: boolean
}

export type RewardClaim = {
  id: string
  partner_id: string
  tier_id: number
  status: 'unlocked' | 'claimed' | 'fulfilled'
  unlocked_at: string
  fulfilled_on: string | null
  notes: string | null
}

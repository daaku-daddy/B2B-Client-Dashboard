'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Field, Input, Problem, Select } from '@/components/ui'
import { Modal } from '@/components/ui/Modal'
import { AREA_TYPES } from '@/lib/domain/areas'
import { createArea, updateArea } from '@/lib/data/actions'
import type { ProjectArea } from '@/lib/domain/types'

export function AreaEditor({
  projectId,
  area,
  open,
  onClose,
  nextSort,
}: {
  projectId: string
  area?: ProjectArea | null
  open: boolean
  onClose: () => void
  nextSort?: number
}) {
  const router = useRouter()
  const [type, setType] = useState(area?.area_type ?? 'living_room')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const typeLabel = AREA_TYPES.find((t) => t.key === type)?.label ?? ''

  function submit(form: FormData) {
    setError(null)
    const numOrNull = (k: string) => {
      const v = String(form.get(k) ?? '').trim()
      if (!v) return null
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    }
    start(async () => {
      const values = {
        area_type: type,
        name: String(form.get('name') ?? '').trim() || typeLabel,
        floor_area_sqft: numOrNull('floor_area_sqft'),
        wall_area_sqft: numOrNull('wall_area_sqft'),
      }
      const res = area
        ? await updateArea(area.id, projectId, values)
        : await createArea({ project_id: projectId, ...values, sort_order: nextSort ?? 0 })
      if (!res.ok) return setError(res.error)
      onClose()
      router.refresh()
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={area ? `Edit ${area.name}` : 'Add a room'}
      hint="Areas are optional, but with them the app can work out quantities for you."
    >
      {error ? <div className="mb-3"><Problem title="Could not save" detail={error} /></div> : null}
      <form action={submit} className="space-y-3">
        <Field label="Which area" required>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            {AREA_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </Select>
        </Field>
        <Field label="Call it" hint={`Leave blank to use "${typeLabel}". Useful when there are two — "Master Bath", "Guest Bath".`}>
          <Input name="name" defaultValue={area?.name ?? ''} placeholder={typeLabel} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Floor area" hint="sqft">
            <Input name="floor_area_sqft" inputMode="decimal" defaultValue={area?.floor_area_sqft ?? ''} />
          </Field>
          <Field label="Wall area" hint="sqft, for tiling / cladding">
            <Input name="wall_area_sqft" inputMode="decimal" defaultValue={area?.wall_area_sqft ?? ''} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Saving…' : area ? 'Save room' : 'Add room'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

'use client'

import { useOrg } from '@components/Contexts/OrgContext'
import { Label } from '@components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select'
import { readCatalogSections } from '@/lib/catalog/sections'

type Props = {
  value: string
  onChange: (value: string) => void
  label: string
  clearLabel: string
}

export default function CatalogSectionSelect({ value, onChange, label, clearLabel }: Props) {
  const org = useOrg() as any // OrgContext is intentionally untyped in the upstream fork.
  const sections = readCatalogSections(org?.config?.config)
  if (sections.length === 0) return null

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value || '__none__'} onValueChange={(next) => onChange(next === '__none__' ? '' : next)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">{clearLabel}</SelectItem>
          {sections.map((section) => (
            <SelectItem key={section.key} value={section.key}>
              {section.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

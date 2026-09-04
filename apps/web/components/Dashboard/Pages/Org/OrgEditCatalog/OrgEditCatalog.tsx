'use client'

import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { Button } from '@components/ui/button'
import { Input } from '@components/ui/input'
import { Plus, Save, Trash2, ArrowDown, ArrowUp } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { readCatalogSections, type CatalogSection } from '@/lib/catalog/sections'
import { updateOrgCourseCatalog } from '@services/organizations/orgs'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'

const slugify = (value: string) => value
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

export default function OrgEditCatalog() {
  const { t } = useTranslation()
  const org = useOrg() as any // OrgContext is intentionally untyped in the upstream fork.
  const session = useLHSession() as any // Session context follows the existing app contract.
  const queryClient = useQueryClient()
  const [sections, setSections] = React.useState<CatalogSection[]>([])
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    setSections(readCatalogSections(org?.config?.config))
  }, [org?.config?.config])

  const update = (index: number, patch: Partial<CatalogSection>) => {
    setSections((current) => current.map((section, position) => (
      position === index ? { ...section, ...patch } : section
    )))
  }

  const add = () => {
    setSections((current) => {
      const used = new Set(current.map((section) => section.key))
      const base = slugify(t('dashboard.organization.catalog.new_section', 'New section')) || 'section'
      let key = base
      let suffix = 2
      while (used.has(key)) key = `${base}-${suffix++}`
      return [...current, { key, title: t('dashboard.organization.catalog.new_section', 'New section'), order: current.length * 10 + 10 }]
    })
  }

  const move = (index: number, direction: -1 | 1) => {
    setSections((current) => {
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= current.length) return current
      const next = [...current]
      ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
      return next.map((section, position) => ({ ...section, order: (position + 1) * 10 }))
    })
  }

  const save = async () => {
    if (!org?.id || !session?.data?.tokens?.access_token) return
    setIsSaving(true)
    try {
      const response = await updateOrgCourseCatalog(
        org.id,
        sections.map((section, index) => ({ ...section, order: (index + 1) * 10 })),
        session.data.tokens.access_token,
      )
      if (!response.success) throw new Error('Catalog section update failed')
      queryClient.invalidateQueries({ queryKey: queryKeys.org.detail(org.slug) })
      toast.success(t('dashboard.organization.catalog.saved', 'Catalog sections saved'))
    } catch {
      toast.error(t('dashboard.organization.catalog.save_error', 'Could not save catalog sections'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="h-full">
      <div className="h-6" />
      <div className="px-4 sm:px-10 pb-10">
        <div className="bg-white rounded-xl shadow-xs p-6 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-gray-600 text-sm">
              {t('dashboard.organization.catalog.description', 'Create and order the sections shown on the public course catalog.')}
            </p>
            <Button type="button" variant="outline" onClick={add}>
              <Plus className="mr-2 h-4 w-4" />{t('dashboard.organization.catalog.add', 'Add section')}
            </Button>
          </div>
          <div className="space-y-3">
            {sections.map((section, index) => (
              <div key={section.key} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end border rounded-lg p-3">
                <div>
                  <label className="text-xs font-medium text-gray-500">{t('dashboard.organization.catalog.key', 'Key')}</label>
                  <Input value={section.key} disabled className="mt-1 bg-gray-50" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">{t('dashboard.organization.catalog.title', 'Title')}</label>
                  <Input value={section.title} onChange={(event) => update(index, { title: event.target.value })} className="mt-1" />
                </div>
                <div className="flex gap-1">
                  <Button type="button" size="icon" variant="outline" disabled={index === 0} onClick={() => move(index, -1)} aria-label={t('dashboard.organization.catalog.move_up', 'Move up')}><ArrowUp className="h-4 w-4" /></Button>
                  <Button type="button" size="icon" variant="outline" disabled={index === sections.length - 1} onClick={() => move(index, 1)} aria-label={t('dashboard.organization.catalog.move_down', 'Move down')}><ArrowDown className="h-4 w-4" /></Button>
                  <Button type="button" size="icon" variant="outline" onClick={() => setSections((current) => current.filter((_, position) => position !== index))} aria-label={t('dashboard.organization.catalog.remove', 'Remove')}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
            {sections.length === 0 && <p className="text-sm text-gray-500">{t('dashboard.organization.catalog.empty', 'No catalog sections configured.')}</p>}
          </div>
          <Button type="button" onClick={save} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />{isSaving ? t('dashboard.organization.catalog.saving', 'Saving...') : t('dashboard.organization.catalog.save', 'Save changes')}
          </Button>
        </div>
      </div>
    </div>
  )
}

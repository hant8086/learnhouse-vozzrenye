'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { updateActivity } from '@services/courses/activities'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useTranslation } from 'react-i18next'

type Props = {
  activity: any
  onSaved: (metadata: Record<string, unknown>) => void
}

export default function ActivityVariantEditor({ activity, onSaved }: Props) {
  const session = useLHSession() as any
  const { t } = useTranslation()
  const metadata = activity.extra_metadata && typeof activity.extra_metadata === 'object'
    ? activity.extra_metadata
    : {}
  const [variant, setVariant] = useState(metadata.access_variant || '')
  const [group, setGroup] = useState(metadata.access_variant_group || '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const next = variant
        ? { access_variant: variant, access_variant_group: group.trim() }
        : { access_variant: null, access_variant_group: null }
      const result = await updateActivity(
        { extra_metadata: next },
        activity.activity_uuid,
        session?.data?.tokens?.access_token,
      )
      if (result?.success === false) throw new Error('update failed')
      onSaved({ ...metadata, ...next })
      toast.success(t('courses.variant_settings_saved'))
    } catch {
      toast.error(t('courses.variant_settings_error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 p-1">
      <label className="block text-sm text-gray-700">
        {t('courses.access_variant')}
        <select
          value={variant}
          onChange={(event) => setVariant(event.target.value)}
          className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm"
        >
          <option value="">{t('courses.access_variant_independent')}</option>
          <option value="unpurchased">{t('courses.access_variant_unpurchased')}</option>
          <option value="purchased">{t('courses.access_variant_purchased')}</option>
        </select>
      </label>
      <label className="block text-sm text-gray-700">
        {t('courses.access_variant_group')}
        <input
          value={group}
          onChange={(event) => setGroup(event.target.value)}
          placeholder="vvedenie-l7"
          disabled={!variant}
          className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm disabled:bg-gray-50"
        />
      </label>
      <button
        type="button"
        onClick={save}
        disabled={saving || (Boolean(variant) && !group.trim())}
        className="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        {saving ? '…' : t('courses.save_variant')}
      </button>
    </div>
  )
}

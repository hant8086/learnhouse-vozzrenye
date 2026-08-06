'use client'
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { createArticle } from '@services/articles/articles'

interface NewArticleModalProps {
  closeModal: () => void
  orgslug: string
}

/**
 * Create-article modal: name (required) and an optional excerpt. On success it
 * routes to `/editor/article/<uuid>/edit` — the block editor route from Task 7 — so
 * the creator lands directly in the body editor.
 */
export default function NewArticleModal(props: NewArticleModalProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const org = useOrg() as any
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token

  const [name, setName] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error(t('articles.name_required', 'Article name is required'))
      return
    }
    if (!org?.id) {
      toast.error(t('articles.org_error', 'Organization context is not available'))
      return
    }
    setSubmitting(true)
    try {
      const created = await createArticle(
        {
          org_id: org.id,
          name: trimmedName,
          excerpt: excerpt.trim() || undefined,
          published: false,
          lock_type: 'public',
        },
        access_token
      )
      const articleUuid = created?.article_uuid
      if (!articleUuid) {
        toast.error(t('articles.create_error', 'Failed to create article'))
        setSubmitting(false)
        return
      }
      toast.success(t('articles.create_success', 'Article created'))
      props.closeModal()
      router.push(`/editor/article/${articleUuid}/edit`)
    } catch (error: any) {
      toast.error(error?.message || t('articles.create_error', 'Failed to create article'))
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="article-name" className="block text-sm font-medium text-gray-700 mb-1">
          {t('articles.name', 'Name')} *
        </label>
        <input
          id="article-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('articles.name_placeholder', 'Article name')}
          className="w-full px-3 py-2.5 bg-white nice-shadow rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 border-0"
        />
      </div>

      <div>
        <label htmlFor="article-excerpt" className="block text-sm font-medium text-gray-700 mb-1">
          {t('articles.excerpt', 'Excerpt')}
        </label>
        <textarea
          id="article-excerpt"
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          placeholder={t('articles.excerpt_placeholder', 'Short preview shown to readers who cannot access the full body')}
          rows={3}
          className="w-full px-3 py-2.5 bg-white nice-shadow rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 border-0 resize-none"
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={props.closeModal}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors"
        >
          {t('common.cancel', 'Cancel')}
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting
            ? t('articles.creating', 'Creating…')
            : t('articles.create_article', 'New article')}
        </button>
      </div>
    </form>
  )
}
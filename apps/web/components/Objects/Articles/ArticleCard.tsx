'use client'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getUriWithOrg } from '@services/config/config'

interface ArticleCardProps {
  article: any
  orgslug: string
  isPriority?: boolean
}

/**
 * Catalog card for an article. A locked article shows the excerpt and a small
 * lock badge — it is a teaser, not a hidden row. Locked articles never
 * disappear from the catalog; the API delivers them with `is_locked=true`,
 * empty content, and the excerpt as the only body text.
 */
export default function ArticleCard(props: ArticleCardProps) {
  const { t } = useTranslation()
  const { article, orgslug } = props

  const target =
    article.slug && !article.slug.startsWith('article_')
      ? `/articles/${article.slug}`
      : `/articles/${article.article_uuid}`

  return (
    <Link
      prefetch={false}
      href={getUriWithOrg(orgslug, target)}
      className="group block h-full overflow-hidden bg-white nice-shadow vz-frame vz-frame-interactive"
    >
      <div className="relative">
        {article.thumbnail_image ? (
          // Thumbnails are stored as free-form strings by the API (no dedicated
          // upload endpoint yet), so only absolute/rooted URLs are usable
          // directly. Anything else falls back to the platform empty thumbnail.
          <img
            src={resolveThumbnail(article.thumbnail_image)}
            alt=""
            className="w-full h-40 object-cover"
          />
        ) : (
          <div className="w-full h-40 bg-gradient-to-br from-gray-50 to-gray-100" />
        )}

        {article.is_locked && (
          <div className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/90 backdrop-blur-sm shadow-sm">
            <Lock size={12} className="text-rose-500" />
            <span className="text-[10px] font-semibold text-rose-500 uppercase tracking-wide">
              {t('articles.locked', 'Locked')}
            </span>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-base first-letter:uppercase line-clamp-2 group-hover:text-gray-700">
          {article.name}
        </h3>
        {article.excerpt && (
          <p className="mt-1.5 text-sm text-gray-500 leading-relaxed line-clamp-3">
            {article.excerpt}
          </p>
        )}
        {!article.excerpt && (
          <p className="mt-1.5 text-sm text-gray-400">
            {article.is_locked
              ? t('articles.access_title', 'Continue reading')
              : t('articles.read_more', 'Read article')}
          </p>
        )}
      </div>
    </Link>
  )
}

function resolveThumbnail(thumb: string): string {
  if (/^https?:\/\//i.test(thumb) || thumb.startsWith('/')) return thumb
  return '/empty_thumbnail.png'
}

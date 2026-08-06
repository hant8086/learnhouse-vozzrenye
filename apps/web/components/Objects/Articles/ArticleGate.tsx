'use client'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getUriWithOrg } from '@services/config/config'

interface ArticleGateProps {
  article: any
  orgslug: string
  isAuthenticated: boolean
}

/**
 * Access gate for a locked or unpublished article. Mirrors the visual language
 * of the activity lock branch (rounded card, rose lock icon, two-button row) so
 * the platform reads as one system. Shows the teaser surface — name, thumbnail,
 * excerpt — that the API deliberately leaves public, then the lock panel.
 */
export default function ArticleGate(props: ArticleGateProps) {
  const { t } = useTranslation()
  const { article, orgslug, isAuthenticated } = props
  const slug = article?.slug

  const signInPath =
    slug && !slug.startsWith('article_')
      ? `/articles/${slug}`
      : article?.article_uuid
        ? `/articles/${article.article_uuid}`
        : ''

  const loginHref = signInPath
    ? `${getUriWithOrg(orgslug, '/login')}?redirect=${encodeURIComponent(signInPath)}`
    : getUriWithOrg(orgslug, '/login')

  return (
    <div className="max-w-2xl mx-auto my-16 px-4">
      {article && (
        <div className="mb-8 text-center">
          {article.thumbnail_image && (
            <img
              src={resolveThumbnail(article.thumbnail_image)}
              alt=""
              className="mx-auto rounded-xl object-cover max-h-64"
            />
          )}
          <h1 className="text-2xl font-bold text-gray-900 mt-4 first-letter:uppercase">
            {article.name}
          </h1>
          {article.excerpt && (
            <p className="mt-3 text-gray-600 leading-relaxed">{article.excerpt}</p>
          )}
        </div>
      )}

      {/* `article-gated-body` marks the region that stands in for the paid body.
          The JSON-LD in `page.tsx` points `hasPart.cssSelector` at this class to
          tell Google which part of the page is not free — without it here the
          selector would resolve to nothing on exactly the pages that carry the
          paywall markup, and the whole `isAccessibleForFree: false` block would
          be ignored. */}
      <div className="article-gated-body bg-white rounded-2xl border border-gray-200/80 shadow-sm p-8 text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center mb-4">
          <Lock className="text-rose-500" size={24} />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {t('articles.gate_title', 'Continue reading')}
        </h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          {isAuthenticated
            ? t(
                'articles.gate_restricted',
                'This article is available to members of a specific group.'
              )
            : t('articles.gate_signin', 'Sign in to read the full article')}
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          {!isAuthenticated && (
            <Link
              href={loginHref}
              className="inline-flex items-center justify-center px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
            >
              {t('auth.sign_in', 'Sign in')}
            </Link>
          )}
          {isAuthenticated && (
            <Link
              href={getUriWithOrg(orgslug, '/articles')}
              className="inline-flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors"
            >
              {t('articles.back_to_articles', 'Back to articles')}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

function resolveThumbnail(thumb: string): string {
  if (/^https?:\/\//i.test(thumb) || thumb.startsWith('/')) return thumb
  // Thumbnails are stored as free-form strings by the API (no dedicated upload
  // endpoint yet), so anything that is not already a URL is a stored file id
  // whose media path the frontend cannot yet resolve. Fall back to the
  // platform's empty thumbnail rather than emitting a broken src.
  return '/empty_thumbnail.png'
}
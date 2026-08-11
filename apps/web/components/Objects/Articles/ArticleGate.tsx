'use client'
import Link from 'next/link'
import { Lock, LogIn, Sparkles, ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getUriWithOrg } from '@services/config/config'

interface ArticleGateProps {
  article: any
  orgslug: string
  isAuthenticated: boolean
}

/**
 * Access gate for a locked or unpublished article. Two real states reach this
 * component (see `article.tsx`): an anonymous visitor (any lock_type — the
 * group check only ever runs once someone is signed in), or a signed-in
 * visitor whose account still isn't in the group the article is restricted
 * to. They read very differently — one is "sign in, it's free", the other is
 * "this is paid group access" — so they get separate copy and treatments
 * instead of one generic "continue reading" panel.
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
    <div className="max-w-2xl mx-auto mt-5 mb-16 px-4 sm:mt-16">
      {article && (
        <div className="mb-8 text-center">
          {article.thumbnail_image && (
            <img
              src={resolveThumbnail(article.thumbnail_image)}
              alt=""
              className="mx-auto rounded-xl object-cover max-h-64 vz-frame"
            />
          )}
          <span className="mono-label">
            {isAuthenticated ? 'PRO / PAID ACCESS' : 'MEMBERS / SIGN IN TO READ'}
          </span>
          {/* The title and excerpt are the whole enticement: a stranger should
              want to unlock THIS piece, not a generic "continue reading" box. */}
          <h1 className="text-2xl font-bold text-gray-900 mt-3 first-letter:uppercase">
            {article.name}
          </h1>
          <div className="vz-hairline mt-4 max-w-xs mx-auto" />
          {article.excerpt && (
            <p className="mt-4 text-lg text-gray-600 leading-relaxed">{article.excerpt}</p>
          )}
        </div>
      )}

      {/* `article-gated-body` marks the region that stands in for the paid body.
          The JSON-LD in `page.tsx` points `hasPart.cssSelector` at this class to
          tell Google which part of the page is not free — without it here the
          selector would resolve to nothing on exactly the pages that carry the
          paywall markup, and the whole `isAccessibleForFree: false` block would
          be ignored. */}
      <div className="article-gated-body vz-frame bg-white p-8 text-center">
        {!isAuthenticated ? (
          <>
            <div className="mx-auto w-14 h-14 rounded-full bg-signal/10 flex items-center justify-center mb-4">
              <Lock className="text-signal" size={24} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {t('articles.gate_signin_title', "There's more to this one")}
            </h2>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed max-w-sm mx-auto">
              {t(
                'articles.gate_signin_body',
                "The full text is open to platform readers. Sign in — it's free and takes less than a minute."
              )}
            </p>
            <Link
              href={loginHref}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
            >
              <LogIn size={15} />
              {t('auth.sign_in', 'Sign in')}
            </Link>
          </>
        ) : (
          <>
            <div className="mx-auto w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mb-4">
              <Sparkles className="text-amber-500" size={24} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {t('articles.gate_restricted_title', 'Exclusive material')}
            </h2>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed max-w-sm mx-auto">
              {t(
                'articles.gate_restricted_body',
                "This article is part of a group's paid access. Members read it in full, along with the rest of the group's exclusive materials."
              )}
            </p>

            {/* Stub offer surface — placeholder copy and a real, working link
                (the course catalog) until a dedicated offer page exists. */}
            <div className="rounded-xl bg-gray-50 border border-gray-200/80 p-5 mb-6 text-left max-w-sm mx-auto">
              <p className="mono-label">
                {t('articles.gate_offer_eyebrow', 'How to get access')}
              </p>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                {t(
                  'articles.gate_offer_body',
                  'Group access unlocks exclusive articles, courses, and community materials.'
                )}
              </p>
              <Link
                href={getUriWithOrg(orgslug, '/courses')}
                className="mt-4 inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
              >
                {t('articles.gate_offer_cta', 'Browse courses')}
                <ArrowRight size={15} />
              </Link>
            </div>

            <Link
              href={getUriWithOrg(orgslug, '/articles')}
              className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              {t('articles.back_to_articles', 'Back to articles')}
            </Link>
          </>
        )}
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
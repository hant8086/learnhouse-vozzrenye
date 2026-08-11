'use client'
import { useTranslation } from 'react-i18next'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { useArticle } from '@/hooks/queries/useArticle'
import CanvaWithStaticFallback from '@components/Objects/Activities/DynamicCanva/CanvaWithStaticFallback'
import ArticleGate from '@components/Objects/Articles/ArticleGate'
import { ScrollPath } from '@components/Objects/Motion/ScrollPath'

interface ArticleClientProps {
  articleuuid: string
  orgslug: string
  article: any | null
  orgUuid?: string | null
}

export default function ArticleClient(props: ArticleClientProps) {
  const { t } = useTranslation()
  const session = useLHSession() as any
  const org = useOrg() as any

  // FORK CHANGE (SEO): seeded from the server fetch in `page.tsx` so a PUBLIC
  // article's body exists in the delivered HTML. A locked article arrives
  // already scrubbed by the API and still hits the gate below — its content is
  // never in the HTML, for any user agent. `useArticle` forces a refetch on
  // mount so a rehydrated token corrects the access state immediately. `org?.id`
  // lets a slug-addressed article resolve the same `slug/{org_id}/{slug}` path
  // the server used — see the comment in `useArticle` for why this is required.
  const { data: article, isLoading } = useArticle(props.articleuuid, org?.id, props.article)

  // Loading or not-found: the server fetch failed with no article at all.
  if (isLoading && !article) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="animate-pulse space-y-4">
          <div className="h-3 bg-gray-200 rounded w-14" />
          <div className="h-8 bg-gray-200 rounded w-2/3" />
          <div className="h-4 bg-gray-100 rounded w-full" />
          <div className="h-4 bg-gray-100 rounded w-[92%]" />
        </div>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          {t('articles.not_found', 'Article not found')}
        </h1>
      </div>
    )
  }

  // The access gate. An anonymous visitor sees the sign-in CTA; a signed-in
  // visitor who still lacks access sees the group-access message.
  if (article.is_locked || !article.published) {
    return (
      <ArticleGate
        article={article}
        orgslug={props.orgslug}
        isAuthenticated={session?.status === 'authenticated'}
      />
    )
  }

  // Public article: render the block content through the same read-only path
  // activities use for SUBTYPE_DYNAMIC_PAGE. This is NOT a second TipTap
  // renderer — the server renders `CanvaStaticContent`, then upgrades to the
  // interactive view on the client. `courseUuid` is deliberately absent:
  // article blocks are parented to the article itself (`parent_uuid`).
  return (
    <>
      <ScrollPath />
      {/* Top spacing matches `GeneralWrapperStyled`'s `py-5` (20px) on mobile —
          pages that route through it show a Breadcrumbs strip right under the
          nav, which visually fills that gap. Articles render no breadcrumb,
          so the larger `py-8` here (kept at `sm:` and up) read as an empty
          hole on narrow screens. */}
      <div className="mx-auto max-w-3xl px-4 pt-5 pb-8 sm:pt-8">
        <article className="space-y-6">
          {article.thumbnail_image && (
            <div className="vz-frame overflow-hidden">
              <img
                src={resolveThumbnail(article.thumbnail_image)}
                alt=""
                className="w-full object-cover"
              />
            </div>
          )}

          <header>
            <span className="mono-label">PUBLIC / ARTICLE READING</span>
            <h1 className="mt-3 text-3xl font-bold text-gray-900 first-letter:uppercase">
              {article.name}
            </h1>
            <div className="vz-hairline mt-4" />
            {article.excerpt && (
              <p className="mt-3 text-lg text-gray-600 leading-relaxed">{article.excerpt}</p>
            )}
          </header>

          {/* `orgUuid` is nullable in our props (the server fetch can fail to
              resolve the org) but the Canva prop is `string | undefined`, so the
              absence has to be passed through as undefined, not null. */}
          <div className="article-gated-body">
            <CanvaWithStaticFallback
              content={article.content}
              activity={article}
              orgUuid={props.orgUuid ?? undefined}
              fallback={
                <div className="flex items-center justify-center py-16">
                  <div className="text-sm text-gray-400">…</div>
                </div>
              }
            />
          </div>
        </article>
      </div>
    </>
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

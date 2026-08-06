import { Metadata } from 'next'
import { JsonLd } from '@components/SEO/JsonLd'
import { getServerCanonicalUrl } from '@/lib/seo/utils.server'
import { loadOrg, loadServerAccessToken } from '@/lib/data/pageData.server'
import { getArticleWithAuthHeader } from '@services/articles/articles'
import ArticleClient from './article'

type MetadataProps = {
  params: Promise<{ orgslug: string; articleuuid: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/**
 * Resolve an article server-side by either its `article_<uuid>` id (links that
 * carry the uuid) or its org-scoped slug (the canonical public URL). Both are
 * supported by the API: the uuid through GET /articles/{uuid}, the slug through
 * GET /articles/slug/{org_id}/{slug}.
 */
async function fetchArticle(
  articleuuid: string,
  org: any,
  access_token: string | null
): Promise<any> {
  const next = { revalidate: 120, tags: ['articles'] }
  if (articleuuid.startsWith('article_')) {
    return getArticleWithAuthHeader(articleuuid, next, access_token).catch(() => null)
  }
  if (org?.id) {
    return getArticleWithAuthHeader(`slug/${org.id}/${articleuuid}`, next, access_token).catch(
      () => null
    )
  }
  return null
}

function resolveArticleImage(article: any): string | null {
  const thumb = article?.thumbnail_image
  if (!thumb) return null
  // Thumbnails are set as free-form strings by the API (no dedicated upload
  // endpoint), so only absolute/rooted URLs are usable directly; anything else
  // falls back to the platform's empty thumbnail.
  if (/^https?:\/\//i.test(thumb) || thumb.startsWith('/')) return thumb
  return null
}

/**
 * schema.org/Article, emitted from the server component so it survives in the
 * raw HTML for crawlers that do not execute JS.
 *
 * The body is deliberately never carried here: structured data describes only
 * what a signed-out visitor could already see. A gated article instead gets the
 * paywalled-content markup Google documents for subscription content — the only
 * sanctioned way to have a restricted page indexed without cloaking.
 */
function buildArticleJsonLd(
  article: any,
  org: any,
  canonicalUrl: string,
  imageUrl?: string | null
) {
  if (!article || !org) return null
  const seo = article.seo || {}
  if (seo.enable_jsonld === false) return null

  const activeAuthors = (article.authors || []).filter(
    (a: any) => a.authorship_status === 'ACTIVE'
  )
  const author = activeAuthors[0]?.user

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: seo.title || article.name,
    ...(article.excerpt && { description: article.excerpt }),
    ...(article.creation_date && { datePublished: article.creation_date }),
    ...(article.update_date && { dateModified: article.update_date }),
    ...(author && {
      author: {
        '@type': 'Person',
        name:
          author.first_name && author.last_name
            ? `${author.first_name} ${author.last_name}`
            : `@${author.username}`,
      },
    }),
    ...(imageUrl && { image: imageUrl }),
    inLanguage: 'ru',
    publisher: {
      '@type': 'Organization',
      name: org.name,
    },
    ...(canonicalUrl && { mainEntityOfPage: canonicalUrl }),
    ...(article.is_locked && {
      // Google's sanctioned paywall markup: the page is indexable, but the gated
      // body region is explicitly not free to read. The server already scrubs
      // `content` to `{}` for a locked caller, so no body text can leak here.
      isAccessibleForFree: false,
      hasPart: {
        '@type': 'WebPageElement',
        isAccessibleForFree: false,
        cssSelector: '.article-gated-body',
      },
    }),
  }
}

export async function generateMetadata(props: MetadataProps): Promise<Metadata> {
  const params = await props.params
  const { orgslug, articleuuid } = params
  const access_token = await loadServerAccessToken()
  const org = await loadOrg(orgslug).catch(() => null)
  const article = await fetchArticle(articleuuid, org, access_token)

  const slug = article?.slug || articleuuid
  const canonical = await getServerCanonicalUrl(orgslug, `/articles/${slug}`)
  const imageUrl = resolveArticleImage(article)
  const seo = article?.seo || {}
  const title = seo.title || article?.name || 'Article'
  const description = seo.description || article?.excerpt || ''

  const noindex = article?.is_locked || article?.published === false

  return {
    title,
    description,
    robots: {
      index: !noindex,
      follow: !noindex,
      googleBot: {
        index: !noindex,
        follow: !noindex,
        'max-image-preview': 'large',
      },
    },
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      publishedTime: article?.creation_date,
      images: [
        {
          url: imageUrl || '/empty_thumbnail.png',
          width: 800,
          height: 600,
          alt: article?.name || title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl || '/empty_thumbnail.png'],
    },
  }
}

// FORK CHANGE (SEO): the article body is fetched server-side and handed down as
// initial data, so PUBLIC article prose is present in the delivered HTML. This
// does NOT widen access: the fetch carries this visitor's own token (none for a
// crawler) and the API scrubs anything they cannot read, so a locked article
// still arrives with `content = {}` / `is_locked = true` and `article.tsx`
// renders the gate. Serving a crawler content a human does not get would be
// cloaking; only PUBLIC content is server-rendered.
const ArticlePage = async (params: any) => {
  const { articleuuid, orgslug } = await params.params
  const access_token = await loadServerAccessToken()
  const org = await loadOrg(orgslug).catch(() => null)
  const article = await fetchArticle(articleuuid, org, access_token)

  const slug = article?.slug || articleuuid
  const canonical = await getServerCanonicalUrl(orgslug, `/articles/${slug}`)
  const imageUrl = resolveArticleImage(article)
  const jsonLd = buildArticleJsonLd(article, org, canonical, imageUrl)

  return (
    <>
      <JsonLd data={jsonLd} />
      <ArticleClient
        articleuuid={articleuuid}
        orgslug={orgslug}
        article={article}
        orgUuid={org?.org_uuid}
      />
    </>
  )
}

export default ArticlePage
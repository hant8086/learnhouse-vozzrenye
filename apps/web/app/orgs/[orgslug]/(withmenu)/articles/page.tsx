import Articles from './articles'
import { Metadata } from 'next'
import { getOrganizationContextInfo } from '@services/organizations/orgs'
import { getOrgOgImageMediaDirectory } from '@services/media/media'
import { getOrgSeoConfig, buildPageTitle } from '@/lib/seo/utils'
import { getServerCanonicalUrl } from '@/lib/seo/utils.server'
import { loadServerAccessToken } from '@/lib/data/pageData.server'
import { getArticlesWithAuthHeader } from '@services/articles/articles'

type MetadataProps = {
  params: Promise<{ orgslug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata(props: MetadataProps): Promise<Metadata> {
  const params = await props.params
  const org = await getOrganizationContextInfo(params.orgslug, {
    revalidate: 120,
    tags: ['organizations'],
  })

  const seoConfig = getOrgSeoConfig(org)
  const ogImageUrl = seoConfig.default_og_image
    ? getOrgOgImageMediaDirectory(org?.org_uuid, seoConfig.default_og_image)
    : null
  const imageUrl = ogImageUrl || '/empty_thumbnail.png'
  const canonical = await getServerCanonicalUrl(params.orgslug, '/articles')
  const title = buildPageTitle('Articles', org.name, seoConfig)
  const description = seoConfig.default_meta_description || ''

  return {
    title,
    description,
    robots: {
      index: true,
      follow: true,
      nocache: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
      },
    },
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      images: [
        {
          url: imageUrl,
          width: 800,
          height: 600,
          alt: org.name,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
      ...(seoConfig.twitter_handle && { site: seoConfig.twitter_handle }),
    },
  }
}

// FORK CHANGE (SEO): the catalog is fetched server-side and handed to the client
// component as initial data, so the delivered HTML carries real teaser cards and
// real links to every article. Without this the page renders `index: true` but
// ships an empty grid — the list only appeared after the client mounted and
// refetched, which any crawler that does not execute JS (and every generative
// crawler today) sees as a blank page.
//
// This does not widen access: the fetch carries this visitor's own token (none
// for a crawler), and the API returns published articles only, with locked ones
// scrubbed to `is_locked: true` and empty content. `useArticles` still refetches
// on mount with `initialDataUpdatedAt: 0`, so a rehydrated session corrects the
// list immediately.
const ArticlesPage = async (params: any) => {
  const orgslug = (await params.params).orgslug
  const org = await getOrganizationContextInfo(orgslug, {
    revalidate: 120,
    tags: ['organizations'],
  }).catch(() => null)
  const access_token = await loadServerAccessToken()
  const articles = org?.id
    ? await getArticlesWithAuthHeader(
        org.id,
        { revalidate: 120, tags: ['articles'] },
        access_token
      ).catch(() => null)
    : null

  return <Articles orgslug={orgslug} initialArticles={articles} />
}

export default ArticlesPage

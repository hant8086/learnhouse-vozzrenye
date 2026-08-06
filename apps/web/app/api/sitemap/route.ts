import { getOrgCourses, getCourseMetadata } from '@services/courses/courses'
import { getOrganizationContextInfo } from '@services/organizations/orgs'
import { getOrgFolders } from '@services/folders/folders'
import { getOrgPodcasts } from '@services/podcasts/podcasts'
import { getCommunities } from '@services/communities/communities'
import { getArticlesWithAuthHeader } from '@services/articles/articles'
import { getLEARNHOUSE_HTTP_PROTOCOL_VAL } from '@services/config/config'
import { NextRequest, NextResponse } from 'next/server'

// FORK CHANGE (SEO): the sitemap previously emitted every <loc> as `http://`
// even on https deployments, because the protocol was reconstructed from the
// proxy's `x-forwarded-proto` (which the reverse proxy does not set) with an
// http fallback. The deployment's own NEXT_PUBLIC_LEARNHOUSE_HTTPS is the
// authority on the scheme it is reachable over, so the origin is built from
// that getter — the same one Task 0 uses for canonical URLs and og:image.
function getBaseUrlFromRequest(request: NextRequest): string {
  const host = request.headers.get('host') || 'localhost'
  const protocol = getLEARNHOUSE_HTTP_PROTOCOL_VAL().replace(/\/+$/, '')
  return `${protocol}://${host}/`
}

export async function GET(request: NextRequest) {
  const orgSlug = request.headers.get('X-Sitemap-Orgslug')
  const sitemapType = request.nextUrl.searchParams.get('type')

  if (!orgSlug) {
    return NextResponse.json(
      { error: 'Missing X-Sitemap-Orgslug header' },
      { status: 400 }
    )
  }

  const baseUrl = getBaseUrlFromRequest(request)

  // If no type specified, return sitemap index
  if (!sitemapType) {
    const sitemapIndex = generateSitemapIndex(baseUrl)
    return new NextResponse(sitemapIndex, {
      headers: { 'Content-Type': 'application/xml' },
    })
  }

  const orgInfo = await getOrganizationContextInfo(orgSlug, null)

  let sitemapUrls: SitemapUrl[] = []

  switch (sitemapType) {
    case 'pages': {
      sitemapUrls = [
        { loc: baseUrl, priority: 1.0, changefreq: 'daily' },
        { loc: `${baseUrl}courses`, priority: 0.9, changefreq: 'weekly' },
        { loc: `${baseUrl}library`, priority: 0.9, changefreq: 'weekly' },
        { loc: `${baseUrl}podcasts`, priority: 0.9, changefreq: 'weekly' },
        { loc: `${baseUrl}communities`, priority: 0.9, changefreq: 'weekly' },
      ]
      break
    }
    case 'courses': {
      const courses = await getOrgCourses(orgSlug, null).catch(() => [])
      for (const course of courses) {
        sitemapUrls.push({
          loc: `${baseUrl}course/${course.course_uuid.replace('course_', '')}`,
          priority: 0.7,
          changefreq: 'weekly',
          lastmod: course.update_date,
        })
      }
      break
    }
    case 'activities': {
      const courses = await getOrgCourses(orgSlug, null).catch(() => [])
      for (const course of courses) {
        try {
          const meta = await getCourseMetadata(
            course.course_uuid.replace('course_', ''),
            null,
            null,
            { slim: true }
          )
          if (meta?.chapters) {
            for (const chapter of meta.chapters) {
              if (chapter.activities) {
                for (const activity of chapter.activities) {
                  const activityId = (activity.activity_uuid || '').replace('activity_', '')
                  if (activityId) {
                    sitemapUrls.push({
                      loc: `${baseUrl}course/${course.course_uuid.replace('course_', '')}/activity/${activityId}`,
                      priority: 0.6,
                      changefreq: 'weekly',
                      lastmod: activity.update_date,
                    })
                  }
                }
              }
            }
          }
        } catch {
          // Skip activities for this course if metadata fetch fails
        }
      }
      break
    }
    case 'folders': {
      const folders = await getOrgFolders(orgInfo.id).catch(() => [])
      for (const folder of folders) {
        sitemapUrls.push({
          loc: `${baseUrl}library/folder/${folder.folder_uuid.replace('folder_', '')}`,
          priority: 0.6,
          changefreq: 'weekly',
          lastmod: folder.update_date,
        })
      }
      break
    }
    case 'podcasts': {
      const podcasts = await getOrgPodcasts(orgSlug, null).catch(() => [])
      for (const podcast of podcasts) {
        sitemapUrls.push({
          loc: `${baseUrl}podcast/${podcast.podcast_uuid.replace('podcast_', '')}`,
          priority: 0.7,
          changefreq: 'weekly',
          lastmod: podcast.update_date,
        })
      }
      break
    }
    case 'communities': {
      const communities = await getCommunities(orgInfo.id, 1, 1000, null).catch(() => [])
      for (const community of communities) {
        sitemapUrls.push({
          loc: `${baseUrl}community/${community.community_uuid.replace('community_', '')}`,
          priority: 0.6,
          changefreq: 'weekly',
          lastmod: community.update_date,
        })
      }
      break
    }
    case 'articles': {
      const articles = await getArticlesWithAuthHeader(orgInfo.id, null, null).catch(() => [])
      for (const article of articles) {
        // Only PUBLIC + published articles belong in the sitemap. A locked or
        // unpublished article renders an identical gate page to every visitor,
        // and a sitemap full of gates reads to search engines as soft-404s.
        if (article?.published !== true || article?.lock_type !== 'public') continue
        if (!article?.slug) continue
        sitemapUrls.push({
          loc: `${baseUrl}articles/${article.slug}`,
          priority: 0.7,
          changefreq: 'weekly',
          lastmod: article.update_date,
        })
      }
      break
    }
    default: {
      return NextResponse.json({ error: 'Invalid sitemap type' }, { status: 400 })
    }
  }

  const sitemap = generateSitemap(sitemapUrls)
  return new NextResponse(sitemap, {
    headers: { 'Content-Type': 'application/xml' },
  })
}

interface SitemapUrl {
  loc: string
  priority: number
  changefreq: string
  lastmod?: string
}

const SITEMAP_TYPES = ['pages', 'courses', 'activities', 'folders', 'podcasts', 'communities', 'articles']

function generateSitemapIndex(baseUrl: string): string {
  const sitemaps = SITEMAP_TYPES.map(type => `
  <sitemap>
    <loc>${baseUrl}sitemap.xml?type=${type}</loc>
  </sitemap>`).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps}
</sitemapindex>`
}

function generateSitemap(urls: SitemapUrl[]): string {
  const urlEntries = urls
    .map(({ loc, priority, changefreq, lastmod }) => {
      let entry = `
    <url>
      <loc>${loc}</loc>
      <priority>${priority.toFixed(1)}</priority>
      <changefreq>${changefreq}</changefreq>`
      if (lastmod) {
        entry += `
      <lastmod>${lastmod.split('T')[0]}</lastmod>`
      }
      entry += `
    </url>`
      return entry
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`
}

import { NextRequest, NextResponse } from 'next/server'
import { getOrganizationContextInfo } from '@services/organizations/orgs'
import { getArticlesWithAuthHeader } from '@services/articles/articles'
import { getLEARNHOUSE_HTTP_PROTOCOL_VAL, getDefaultOrg } from '@services/config/config'

/**
 * /llms.txt — a lightweight text index for AI crawlers (convention, not a
 * standard). Same shape as the robots route: a plain-text route handler under
 * app/, scoped to the current organization.
 *
 * Only PUBLIC + published articles are listed. A locked or unpublished article
 * renders an identical gate page to every visitor, so listing it here would
 * waste a crawler's budget on soft-404s — same rule as the sitemap.
 *
 * NOTE on tenancy: the proxy rewrites /robots.txt and /sitemap.xml to their
 * /api counterparts and injects the org slug via a header, but /llms.txt is
 * outside that rewrite list and proxy.ts is out of scope for this task. In
 * single tenancy (the production deployment) the middleware still sets the
 * `LH_default_org` cookie, so `getDefaultOrg()` resolves the correct slug. In
 * multi tenancy this routes only the default org's articles — a follow-up can
 * add a proxy rewrite mirroring the robots branch.
 */
export async function GET(request: NextRequest) {
  const orgSlug =
    request.headers.get('X-Llms-Orgslug') || getDefaultOrg()

  if (!orgSlug) {
    return new NextResponse(`User-agent: *
Disallow: /
`, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  const host = request.headers.get('host') || 'localhost'
  const protocol = getLEARNHOUSE_HTTP_PROTOCOL_VAL().replace(/\/+$/, '')
  const baseUrl = `${protocol}://${host}/`

  let org: any = null
  try {
    org = await getOrganizationContextInfo(orgSlug, null)
  } catch {
    org = null
  }

  let articles: any[] = []
  if (org?.id) {
    try {
      const list = await getArticlesWithAuthHeader(org.id, null, null)
      articles = Array.isArray(list) ? list : []
    } catch {
      articles = []
    }
  }

  const publicArticles = articles.filter(
    (article) => article?.published === true && article?.lock_type === 'public' && article?.slug
  )

  const lines: string[] = []
  lines.push(`# ${org?.name || 'LearnHouse Academy'}`)
  lines.push(
    org?.description ||
    'Keep exploring our articles and learning materials.'
  )
  lines.push('')

  if (publicArticles.length > 0) {
    lines.push('## Articles')
    for (const article of publicArticles) {
      const title = article.name?.replace(/[[\]]/g, '').trim() || 'Untitled'
      const excerpt = (article.excerpt || '').replace(/\n+/g, ' ').trim()
      lines.push(`- [${title}](${baseUrl}articles/${article.slug})${excerpt ? `: ${excerpt}` : ''}`)
    }
    lines.push('')
  }

  return new NextResponse(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
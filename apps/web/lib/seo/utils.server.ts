import { headers } from 'next/headers'
import { getCanonicalUrl } from './utils'
import { getLEARNHOUSE_HTTP_PROTOCOL_VAL } from '@services/config/config'

/**
 * Async canonical URL for Server Components / `generateMetadata`.
 *
 * Reads the `x-lh-tenancy`, `x-lh-top-domain`, `x-lh-custom-domain` request
 * headers set by the middleware on every tenant-scoped request, and builds a
 * fully qualified absolute URL appropriate for the current tenancy mode and
 * host. Falls back to the request `host` header when tenancy headers aren't
 * present, and finally to the sync `getCanonicalUrl` (relative path) outside
 * a request context (e.g. unit tests).
 *
 * Lives in a `.server.ts` file because `next/headers` is server-only —
 * importing it from a module any client component reaches breaks the build.
 */
export async function getServerCanonicalUrl(orgslug: string, path: string): Promise<string> {
  try {
    const h = await headers()
    const tenancy = h.get('x-lh-tenancy')
    const customDomain = h.get('x-lh-custom-domain')
    const topDomain = h.get('x-lh-top-domain')
    // FORK CHANGE (SEO): production emitted `<link rel="canonical" href="http://…">`
    // on an https-only deployment because the reverse proxy does not set
    // x-forwarded-proto. The deployment's own NEXT_PUBLIC_LEARNHOUSE_HTTPS is the
    // authority on the scheme it is reachable over, so when it says https we never
    // downgrade to whatever a proxy hop happened to report.
    const configuredHttps = getLEARNHOUSE_HTTP_PROTOCOL_VAL() === 'https://'
    const proto = configuredHttps ? 'https' : (h.get('x-forwarded-proto') ?? 'https')

    if (customDomain) {
      return `${proto}://${customDomain}${path}`.replace(/\/+$/, '')
    }
    if (tenancy === 'multi' && topDomain && topDomain !== 'localhost') {
      return `https://${orgslug}.${topDomain}${path}`.replace(/\/+$/, '')
    }
    const host = h.get('host')
    if (host) {
      const scheme = host.includes('localhost') || host.startsWith('127.') ? 'http' : proto
      return `${scheme}://${host}${path}`.replace(/\/+$/, '')
    }
  } catch {
    // headers() may throw outside a request context.
  }
  return getCanonicalUrl(orgslug, path)
}

/**
 * FORK CHANGE (SEO): per-request memoised server loaders.
 *
 * `RequestBodyWithAuthHeader` sets `cache: 'no-store'` on every API call (on
 * purpose — the Next data cache keys by URL+method+body only, so an authed
 * response could be served to an anonymous caller). That also means Next will
 * NOT dedupe two identical fetches inside one request.
 *
 * Server-rendering the course/activity bodies needs the same payload that
 * `generateMetadata` already fetches. Wrapping the loaders in React `cache()`
 * makes `generateMetadata` and the page component share a single in-flight
 * request per render pass instead of hitting the API twice.
 *
 * Keep the arguments primitive — `cache()` memoises on argument identity, so an
 * inline `{ revalidate, tags }` object literal would defeat it. That is why the
 * `next` options live inside each loader.
 *
 * Server-only by convention (`.server.ts`, mirroring `lib/seo/utils.server.ts`).
 * Never import this from a client component.
 */
import { cache } from 'react'
import { getCourseMetadata } from '@services/courses/courses'
import { getActivityWithAuthHeader } from '@services/courses/activities'
import { getOrganizationContextInfo } from '@services/organizations/orgs'
import { getServerSession } from '@/lib/auth/server'

export const loadServerAccessToken = cache(async (): Promise<string | null> => {
  const session = await getServerSession()
  return session?.tokens?.access_token ?? null
})

export const loadOrg = cache(async (orgslug: string) =>
  getOrganizationContextInfo(orgslug, {
    revalidate: 120,
    tags: ['organizations'],
  })
)

export const loadCourseMeta = cache(async (courseuuid: string, accessToken: string | null) =>
  getCourseMetadata(
    courseuuid,
    { revalidate: 120, tags: ['courses'] },
    accessToken,
    { slim: true }
  )
)

export const loadActivity = cache(async (activityid: string, accessToken: string | null) =>
  getActivityWithAuthHeader(
    activityid,
    { revalidate: 120, tags: ['activities'] },
    accessToken
  )
)

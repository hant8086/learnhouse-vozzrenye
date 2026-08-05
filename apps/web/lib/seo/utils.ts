import { getUriWithOrg } from '@services/config/config'

/**
 * Sync canonical URL — safe for client components.
 *
 * Resolves via cookies on the client; falls through to a relative path on
 * the server. Server pages emitting `<meta canonical>`, og:url, or JSON-LD
 * URLs should use `getServerCanonicalUrl` from `@/lib/seo/utils.server`
 * instead — it reads tenancy from middleware-injected request headers and
 * works on cold loads where cookies aren't yet visible to RSC.
 */
export function getCanonicalUrl(orgslug: string, path: string): string {
  return getUriWithOrg(orgslug, path).replace(/\/+$/, '')
}

export function getOrgSeoConfig(org: any) {
  return org?.config?.config?.customization?.seo || org?.config?.config?.seo || {}
}

export function buildPageTitle(pageTitle: string, orgName: string, seoConfig: any): string {
  const suffix = seoConfig.default_meta_title_suffix
  if (suffix) return `${pageTitle}${suffix}`
  return `${pageTitle} — ${orgName}`
}

/**
 * FORK CHANGE (SEO): schema.org/Course for a course page.
 *
 * Moved out of the `course.tsx` client component so `page.tsx` can emit it
 * server-side. Honours the existing `enable_jsonld` flag in CourseSEO
 * (absent = enabled, matching the previous client behaviour) and returns null
 * when there is nothing safe to describe.
 */
export function buildCourseJsonLd(course: any, org: any, imageUrl?: string | null) {
  if (!course || !org) return null
  const seo = course.seo || {}
  if (seo.enable_jsonld === false) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: seo.title || course.name,
    description: seo.description || course.description || '',
    provider: {
      '@type': 'Organization',
      name: org.name,
      ...(org.description && { description: org.description }),
    },
    ...(imageUrl && { image: imageUrl }),
    ...(course.creation_date && { dateCreated: course.creation_date }),
    ...(course.update_date && { dateModified: course.update_date }),
  }
}

/**
 * FORK CHANGE (SEO): schema.org/LearningResource for a single activity.
 *
 * Metadata only — it deliberately carries no body text, so a locked activity is
 * never described by anything a signed-out human could not already see.
 */
export function buildActivityJsonLd(
  activity: any,
  course: any,
  org: any,
  opts?: { url?: string | null; image?: string | null }
) {
  if (!activity || !course || !org) return null
  const seo = course.seo || {}
  if (seo.enable_jsonld === false) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: activity.name,
    ...(opts?.url && { url: opts.url }),
    ...(opts?.image && { image: opts.image }),
    ...(activity.activity_type && { learningResourceType: activity.activity_type }),
    isPartOf: {
      '@type': 'Course',
      name: course.name,
      ...(course.description && { description: course.description }),
    },
    provider: {
      '@type': 'Organization',
      name: org.name,
    },
    ...(course.creation_date && { dateCreated: course.creation_date }),
    ...(activity.update_date && { dateModified: activity.update_date }),
  }
}

export function buildBreadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

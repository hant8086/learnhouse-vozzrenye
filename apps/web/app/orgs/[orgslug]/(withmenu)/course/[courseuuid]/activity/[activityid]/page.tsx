import ActivityClient from './activity'
import { getCourseThumbnailMediaDirectory, getOrgOgImageMediaDirectory } from '@services/media/media'
import { Metadata } from 'next'
import { getOrgSeoConfig, buildActivityJsonLd } from '@/lib/seo/utils'
import { getServerCanonicalUrl } from '@/lib/seo/utils.server'
import { JsonLd } from '@components/SEO/JsonLd'
// FORK CHANGE (SEO): memoised per-request loaders, shared with generateMetadata
// so server-rendering the body does not double-fetch course/activity.
import { loadOrg, loadCourseMeta, loadActivity, loadServerAccessToken } from '@/lib/data/pageData.server'

type MetadataProps = {
  params: Promise<{ orgslug: string; courseuuid: string; activityid: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata(props: MetadataProps): Promise<Metadata> {
  const params = await props.params;
  const access_token = await loadServerAccessToken()

  // React-cached loaders — the page component below reuses these responses.
  const [org, course_meta, activity] = await Promise.all([
    loadOrg(params.orgslug),
    loadCourseMeta(params.courseuuid, access_token),
    loadActivity(params.activityid, access_token),
  ])

  // Check if this is the course end page
  const isCourseEnd = params.activityid === 'end';
  const seoConfig = getOrgSeoConfig(org)
  const rawTitle = isCourseEnd ? `Congratulations — ${course_meta.name} Course` : `${activity.name} — ${course_meta.name} Course`
  const pageTitle = seoConfig.default_meta_title_suffix ? `${rawTitle}${seoConfig.default_meta_title_suffix}` : rawTitle

  const orgOgImageUrl = seoConfig.default_og_image
    ? getOrgOgImageMediaDirectory(org?.org_uuid, seoConfig.default_og_image)
    : null
  const imageUrl = course_meta?.thumbnail_image
    ? getCourseThumbnailMediaDirectory(
        org?.org_uuid,
        course_meta?.course_uuid,
        course_meta?.thumbnail_image
      )
    : orgOgImageUrl || '/empty_thumbnail.png'
  const canonical = await getServerCanonicalUrl(params.orgslug, `/course/${params.courseuuid}/activity/${params.activityid}`)

  // SEO
  return {
    title: pageTitle,
    description: course_meta.description || seoConfig.default_meta_description || '',
    keywords: course_meta.learnings,
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
      title: pageTitle,
      description: course_meta.description || seoConfig.default_meta_description || '',
      publishedTime: course_meta.creation_date,
      tags: course_meta.learnings,
      images: [
        {
          url: imageUrl,
          width: 800,
          height: 600,
          alt: course_meta.name,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description: course_meta.description || seoConfig.default_meta_description || '',
      images: [imageUrl],
      ...(seoConfig.twitter_handle && { site: seoConfig.twitter_handle }),
    },
  }
}

// FORK CHANGE (SEO): upstream passed `activity={null} course={null}` and let the
// browser fetch both, so the delivered HTML contained no lesson text at all.
// We now fetch server-side (the same React-cached calls generateMetadata made)
// and pass the payloads down as initial data, plus emit JSON-LD here.
//
// This does NOT change what a locked resource delivers. The fetch carries this
// visitor's own access token — none at all for a crawler — and the API scrubs
// what they may not read, so a locked activity still arrives with `content = {}`
// and `is_locked = true` and `activity.tsx` renders the locked screen. Serving a
// crawler content a human does not get would be cloaking; we only make PUBLIC
// content server-rendered.
const ActivityPage = async (params: any) => {
  const { activityid, courseuuid, orgslug } = await params.params
  const access_token = await loadServerAccessToken()

  const [org, course, activity] = await Promise.all([
    loadOrg(orgslug).catch(() => null),
    loadCourseMeta(courseuuid, access_token).catch(() => null),
    // `activityid` is the literal 'end' on the course-completion screen, which
    // has no activity record — a failure here is expected, not exceptional.
    loadActivity(activityid, access_token).catch(() => null),
  ])

  const jsonLdImage = course?.thumbnail_image
    ? getCourseThumbnailMediaDirectory(org?.org_uuid, course?.course_uuid, course?.thumbnail_image)
    : null
  const canonical = await getServerCanonicalUrl(
    orgslug,
    `/course/${courseuuid}/activity/${activityid}`
  )
  // Describe only what the visitor was actually served: no JSON-LD for a locked
  // activity, so structured data can never advertise gated material.
  const jsonLd = activity?.is_locked
    ? null
    : buildActivityJsonLd(activity, course, org, { url: canonical, image: jsonLdImage })

  return (
    <>
      <JsonLd data={jsonLd} />
      <ActivityClient
        activityid={activityid}
        courseuuid={courseuuid}
        orgslug={orgslug}
        activity={activity}
        course={course}
      />
    </>
  )
}

export default ActivityPage

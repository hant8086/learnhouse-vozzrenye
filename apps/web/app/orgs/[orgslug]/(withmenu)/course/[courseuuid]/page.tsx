import React from 'react'
import CourseClient from './course'
import { Metadata } from 'next'
import { getCourseThumbnailMediaDirectory, getOrgOgImageMediaDirectory } from '@services/media/media'
import { getOrgSeoConfig, buildPageTitle, buildCourseJsonLd } from '@/lib/seo/utils'
import { getServerCanonicalUrl } from '@/lib/seo/utils.server'
import { JsonLd } from '@components/SEO/JsonLd'
// FORK CHANGE (SEO): memoised per-request loaders, shared with generateMetadata
// so server-rendering the body does not double-fetch the course.
import { loadOrg, loadCourseMeta, loadServerAccessToken } from '@/lib/data/pageData.server'


type MetadataProps = {
  params: Promise<{ orgslug: string; courseuuid: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata(props: MetadataProps): Promise<Metadata> {
  const params = await props.params;
  const access_token = await loadServerAccessToken()

  // Parallelize org + course metadata fetches. Both loaders are React-cached for
  // the request, so the page component below reuses these exact responses.
  const [org, courseResult] = await Promise.all([
    loadOrg(params.orgslug),
    loadCourseMeta(params.courseuuid, access_token).catch(() => null),
  ])

  if (!courseResult) {
    return {
      title: `Course — ${org?.name || 'LearnHouse'}`,
      description: 'View this course on LearnHouse',
    }
  }
  const course_meta = courseResult

  // SEO - use custom SEO fields with fallbacks to existing fields
  const seoConfig = getOrgSeoConfig(org)
  const seo = course_meta.seo || {}
  const defaultTitle = buildPageTitle(course_meta.name, org.name, seoConfig)
  const defaultDescription = course_meta.description || seoConfig.default_meta_description || ''
  const orgOgImageUrl = seoConfig.default_og_image
    ? getOrgOgImageMediaDirectory(org?.org_uuid, seoConfig.default_og_image)
    : null
  const defaultImage = course_meta?.thumbnail_image
    ? getCourseThumbnailMediaDirectory(
        org?.org_uuid,
        course_meta?.course_uuid,
        course_meta?.thumbnail_image
      )
    : orgOgImageUrl || '/empty_thumbnail.png'

  // Determine robots settings
  const shouldIndex = !seo.robots_noindex
  const shouldFollow = !seo.robots_nofollow

  return {
    title: seo.title || defaultTitle,
    description: seo.description || defaultDescription,
    keywords: seo.keywords || course_meta.learnings,
    robots: {
      index: shouldIndex,
      follow: shouldFollow,
      nocache: true,
      googleBot: {
        index: shouldIndex,
        follow: shouldFollow,
        'max-image-preview': 'large',
      },
    },
    alternates: {
      canonical: seo.canonical_url || (await getServerCanonicalUrl(params.orgslug, `/course/${params.courseuuid}`)),
    },
    openGraph: {
      title: seo.og_title || seo.title || defaultTitle,
      description: seo.og_description || seo.description || defaultDescription,
      images: [
        {
          url: seo.og_image || defaultImage,
          width: 800,
          height: 600,
          alt: course_meta.name,
        },
      ],
      type: 'article',
      publishedTime: course_meta.creation_date ? course_meta.creation_date : '',
      tags: course_meta.learnings ? course_meta.learnings : [],
    },
    twitter: {
      card: (seo.twitter_card as 'summary' | 'summary_large_image') || 'summary_large_image',
      title: seo.twitter_title || seo.og_title || seo.title || defaultTitle,
      description: seo.twitter_description || seo.og_description || seo.description || defaultDescription,
      images: [seo.og_image || defaultImage],
      ...(seoConfig.twitter_handle && { site: seoConfig.twitter_handle }),
    },
  }
}

// FORK CHANGE (SEO): upstream rendered `<CourseClient course={null} />` and let
// the browser fetch the course, so the delivered HTML held no course body at all.
// We now fetch server-side (the same React-cached call generateMetadata made) and
// hand the payload down as initial data, plus emit JSON-LD from this server
// component. Access control is unchanged: the fetch carries this visitor's token
// (none for a crawler) and the API scrubs anything they may not read, so a locked
// resource still arrives with `content = {}` / `is_locked = true`.
const CoursePage = async (params: any) => {
  const { courseuuid, orgslug } = await params.params
  const access_token = await loadServerAccessToken()

  // An Error instance is not serializable across the RSC boundary — hand the
  // client a plain shape carrying only what `course.tsx` reads (`.status`).
  const [org, courseResult] = await Promise.all([
    loadOrg(orgslug).catch(() => null),
    loadCourseMeta(courseuuid, access_token).then(
      (data: any) => ({ data, error: null as any }),
      (error: any) => ({ data: null, error: { status: error?.status ?? null } })
    ),
  ])

  const course = courseResult.data
  const serverError = courseResult.error

  const jsonLdImage = course?.thumbnail_image
    ? getCourseThumbnailMediaDirectory(org?.org_uuid, course?.course_uuid, course?.thumbnail_image)
    : null
  const jsonLd = buildCourseJsonLd(course, org, jsonLdImage)

  return (
    <>
      <JsonLd data={jsonLd} />
      <CourseClient
        courseuuid={courseuuid}
        orgslug={orgslug}
        course={course}
        serverError={serverError}
      />
    </>
  )
}

export default CoursePage

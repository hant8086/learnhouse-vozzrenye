'use client'
import Link from 'next/link'
import React, { useEffect, useState, Suspense } from 'react'
import { getUriWithOrg } from '@services/config/config'
import { getCourseMetadata } from '@services/courses/courses'
import { useTrail } from '@/hooks/queries/useTrail'
import ActivityIndicators from '@components/Pages/Courses/ActivityIndicators'
import { useRouter } from 'next/navigation'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import {
  getCourseThumbnailMediaDirectory,
} from '@services/media/media'
import { ArrowRight, Backpack, Check, File, StickyNote, Video, Square, Image as ImageIcon, Layers, BookCopy, Lock, Globe, Package, Puzzle } from 'lucide-react'
import { MarkdownLogo } from '@phosphor-icons/react'
import { useOrg } from '@components/Contexts/OrgContext'
import { CourseProvider } from '@components/Contexts/CourseContext'
import { useMediaQuery } from 'usehooks-ts'
import CoursesActions from '@components/Objects/Courses/CourseActions/CoursesActions'
import CourseActionsMobile from '@components/Objects/Courses/CourseActions/CourseActionsMobile'
import CourseAuthors from '@components/Objects/Courses/CourseAuthors/CourseAuthors'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { getActivityWithAuthHeader } from '@services/courses/activities'
import { useTranslation } from 'react-i18next'
import CourseCommunitySection from '@components/Objects/Communities/CourseCommunitySection'
import CourseShare from '@components/Objects/Courses/CourseShare/CourseShare'
import { useLHAnalytics, AnalyticsEvent } from '@services/analytics'
import { RevealGroup, RevealItem } from '@components/Objects/Motion/Reveal'
import { ScrollPath } from '@components/Objects/Motion/ScrollPath'
import { getTagColorStyle, normalizeTagColors, parseCourseTags } from '@/lib/courses/tagColors'

const CourseClient = (props: any) => {
  const { t } = useTranslation()
  const [learnings, setLearnings] = useState<any>([])
  const [expandedChapters, setExpandedChapters] = useState<{[key: string]: boolean}>({})
  const [activeThumbnailType, setActiveThumbnailType] = useState<'image' | 'video'>('image')
  const courseuuid = props.courseuuid
  const orgslug = props.orgslug
  const initialCourse = props.course
  const serverError = props.serverError
  const org = useOrg() as any
  const _router = useRouter()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const sessionIdentity = session?.status === 'authenticated'
    ? String(session?.data?.user?.user_uuid ?? session?.data?.user?.id ?? 'authenticated')
    : 'anonymous'
  const queryClient = useQueryClient()

  // FORK CHANGE (SEO): `page.tsx` now server-fetches the course and passes it in,
  // so the body exists in the delivered HTML. Seeding it as `initialData` (rather
  // than short-circuiting the query) keeps a single source of truth in the query
  // cache — the activity page reads the same key — and still lets the client
  // revalidate once the data goes stale.
  const { data: course, error: courseError, isLoading: courseLoading } = useQuery({
    queryKey: queryKeys.courses.meta(courseuuid, sessionIdentity),
    queryFn: () => getCourseMetadata(courseuuid, {}, access_token, { slim: true }),
    // Deliberately NOT gated on `serverError`: a signed-in visitor whose access
    // token cookie has expired renders server-side as anonymous, so a private
    // course 403s during SSR. The client must still be allowed to retry with the
    // refreshed token, otherwise they are stuck on the access-denied screen.
    enabled: !!courseuuid,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    initialData: initialCourse ?? undefined,
    initialDataUpdatedAt: initialCourse ? 0 : undefined,
  });

  const { track } = useLHAnalytics('learner')

  // Track course view
  const courseId = course?.id
  const courseUuidForTracking = course?.course_uuid
  useEffect(() => {
    if (courseId && courseUuidForTracking) {
      track(AnalyticsEvent.CourseViewed, {
        course_uuid: courseUuidForTracking,
      })
    }
  }, [courseId, courseUuidForTracking, track])

  // Fetch trail data — shared cache with useTrail hook used elsewhere
  const { data: trailData } = useTrail(org?.id);

  // Must be before any early returns (React rules of hooks)
  useEffect(() => {
    if (!course) return

    getLearningTags(course)

    if (course?.chapters) {
      const totalActivities = course.chapters.reduce((sum: number, chapter: any) => sum + (chapter.activities?.length || 0), 0)
      const defaultExpanded: {[key: string]: boolean} = {}
      course.chapters.forEach((chapter: any, idx: number) => {
        defaultExpanded[chapter.chapter_uuid] = idx === 0 ? true : totalActivities <= 5
      })
      setExpandedChapters(defaultExpanded)
    }
  }, [course])

  // Show loading state if fetching course data client-side. A server-side error
  // no longer short-circuits to the error screen: the client retry above may
  // still succeed (expired access-token cookie, refreshed on hydration), so keep
  // showing the skeleton until that retry settles.
  if (!course && courseLoading) {
    return (
      <GeneralWrapperStyled>
        <div className="animate-pulse">
          {/* Breadcrumb placeholder */}
          <div className="pb-4 flex items-center gap-2">
            <div className="h-3 bg-gray-200 rounded w-16" />
            <div className="h-3 bg-gray-200 rounded w-2" />
            <div className="h-3 bg-gray-200 rounded w-32" />
          </div>

          {/* Course title + share row */}
          <div className="pb-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div className="h-9 bg-gray-200 rounded w-2/3" />
            <div className="h-8 bg-gray-200 rounded-lg w-24" />
          </div>

          {/* Main content: left 3/4 + right 1/4 sidebar */}
          <div className="vz-course-hero">
            {/* Left column */}
            <div className="vz-course-summary space-y-4">
              {/* Thumbnail */}
              <div className="bg-gray-200 rounded-lg w-full h-[200px] md:h-[400px]" />
              {/* About text block */}
              <div className="space-y-2 py-2">
                <div className="h-3 bg-gray-200 rounded w-full" />
                <div className="h-3 bg-gray-200 rounded w-5/6" />
                <div className="h-3 bg-gray-200 rounded w-4/6" />
                <div className="h-3 bg-gray-200 rounded w-full" />
                <div className="h-3 bg-gray-200 rounded w-3/4" />
              </div>
            </div>

            {/* Right sidebar */}
            <div className="w-full md:w-1/4 space-y-4">
              {/* Actions box */}
              <div className="bg-gray-200 rounded-lg h-40" />
              {/* Authors box */}
              <div className="bg-gray-200 rounded-lg h-24" />
            </div>
          </div>

          {/* Chapter list */}
          <div className="vz-course-section w-full mb-10">
            <div className="h-7 bg-gray-200 rounded w-40 mb-5" />
            <div className="bg-white shadow-md shadow-gray-300/25 outline outline-1 outline-neutral-200/40 rounded-lg overflow-hidden">
              {Array.from({ length: 3 }).map((_, chIdx) => (
                <div key={chIdx}>
                  {/* Chapter header */}
                  <div className="flex items-center gap-3 py-4 px-4 bg-neutral-50 outline outline-1 outline-neutral-200/40">
                    <div className="h-5 w-5 bg-gray-200 rounded-full flex-shrink-0" />
                    <div className="h-5 bg-gray-200 rounded w-5 flex-shrink-0" />
                    <div className="h-5 bg-gray-200 rounded w-1/3" />
                  </div>
                  {/* Activity rows — only expand first chapter */}
                  {chIdx === 0 && Array.from({ length: 3 }).map((_, aIdx) => (
                    <div key={aIdx} className="flex items-center gap-3 px-4 py-4 border-t border-neutral-100">
                      <div className="h-4 w-4 bg-gray-200 rounded flex-shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-4 bg-gray-200 rounded w-1/2" />
                        <div className="h-3 bg-gray-200 rounded w-20" />
                      </div>
                      <div className="h-4 w-4 bg-gray-200 rounded flex-shrink-0" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </GeneralWrapperStyled>
    )
  }

  // Determine the active error (server-side or client-side)
  const activeError = serverError || courseError

  // Show error if course fetch failed
  if (!course && activeError) {
    return (
      <GeneralWrapperStyled>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            {t('course.accessDenied', 'Unable to access this course')}
          </h2>
          <p className="text-gray-500 mb-4">
            {activeError?.status === 403
              ? t('course.noPermission', 'You do not have permission to view this course.')
              : t('course.loadError', 'This course could not be found or there was an error loading it.')}
          </p>
          <Link href={getUriWithOrg(orgslug, '/courses')} className="text-blue-600 hover:underline">
            {t('course.backToCourses', 'Back to Courses')}
          </Link>
        </div>
      </GeneralWrapperStyled>
    )
  }

  function getLearningTags(courseData: any) {
    if (!courseData?.learnings) {
      setLearnings([])
      return
    }

    try {
      // Try to parse as JSON (new format)
      const parsedLearnings = JSON.parse(courseData.learnings)
      if (Array.isArray(parsedLearnings)) {
        // New format: array of learning items with text and emoji
        setLearnings(parsedLearnings)
        return
      }
    } catch (_e) {
      // Not valid JSON, continue to legacy format handling
    }

    // Legacy format: comma-separated string (changed from pipe-separated)
    const learningItems = courseData.learnings.split(',').map((text: string) => ({
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      text: text.trim(), // Trim whitespace that might be present after commas
      emoji: '📝' // Default emoji for legacy items
    }))

    setLearnings(learningItems)
  }

  const getActivityTypeLabel = (activityType: string, activitySubType?: string) => {
    if (activitySubType === 'SUBTYPE_DYNAMIC_MARKDOWN') return t('activities.markdown')
    if (activitySubType === 'SUBTYPE_DYNAMIC_EMBED') return t('activities.embed')
    switch (activityType) {
      case 'TYPE_VIDEO':
        return t('activities.video')
      case 'TYPE_DOCUMENT':
        return t('activities.document')
      case 'TYPE_DYNAMIC':
        return t('activities.page')
      case 'TYPE_ASSIGNMENT':
        return t('activities.assignment')
      case 'TYPE_SCORM':
        return t('activities.scorm')
      case 'TYPE_CUSTOM':
        return t('activities.custom')
      default:
        return t('activities.learning_material')
    }
  }

  const getActivityTypeIcon = (activityType: string, activitySubType?: string, size: number = 10) => {
    if (activitySubType === 'SUBTYPE_DYNAMIC_MARKDOWN') return <MarkdownLogo size={size} />
    if (activitySubType === 'SUBTYPE_DYNAMIC_EMBED') return <Globe size={size} />
    switch (activityType) {
      case 'TYPE_VIDEO':
        return <Video size={size} />
      case 'TYPE_DOCUMENT':
        return <File size={size} />
      case 'TYPE_DYNAMIC':
        return <StickyNote size={size} />
      case 'TYPE_ASSIGNMENT':
        return <Backpack size={size} />
      case 'TYPE_SCORM':
        return <Package size={size} />
      case 'TYPE_CUSTOM':
        return <Puzzle size={size} />
      default:
        return <Layers size={size} />
    }
  }

  const _getActivityTypeBadgeColor = (activityType: string) => {
    switch (activityType) {
      case 'TYPE_VIDEO':
        return 'bg-neutral-100 text-neutral-500'
      case 'TYPE_DOCUMENT':
        return 'bg-neutral-100 text-neutral-500'
      case 'TYPE_DYNAMIC':
        return 'bg-neutral-100 text-neutral-500'
      case 'TYPE_ASSIGNMENT':
        return 'bg-neutral-100 text-neutral-500'
      default:
        return 'bg-neutral-100 text-neutral-500'
    }
  }

  const isActivityDone = (activity: any) => {
    if (!course?.course_uuid || !trailData?.runs || !Array.isArray(trailData.runs)) {
      return false
    }
    const cleanCourseUuid = course.course_uuid.replace('course_', '')
    const run = trailData.runs.find((run: any) => {
      const cleanRunCourseUuid = run.course?.course_uuid?.replace('course_', '')
      return cleanRunCourseUuid === cleanCourseUuid
    })
    if (!run || !Array.isArray(run.steps)) return false
    return !!run.steps.find((step: any) => step.activity_id == activity.id)
  }

  const isActivityCurrent = (activity: any) => {
    if (!activity?.activity_uuid) return false
    const activity_uuid = activity.activity_uuid.replace('activity_', '')
    return props.current_activity === activity_uuid
  }

  const handleActivityMouseEnter = (activity: any) => {
    if (!activity?.activity_uuid) return
    const cleanUuid = activity.activity_uuid.replace('activity_', '')
    queryClient.prefetchQuery({
      queryKey: queryKeys.activity.detail(cleanUuid),
      queryFn: () => getActivityWithAuthHeader(cleanUuid, {}, access_token),
      staleTime: 60_000,
    })
  }

  // FORK CHANGE (SEO): the schema.org/Course block used to be built here, inside
  // the client subtree, so it never reached the delivered HTML. It now lives in
  // `page.tsx` (server) via `buildCourseJsonLd`.

  return (
    <>
      <ScrollPath />
      {!course ? null : (
        <>
          <GeneralWrapperStyled>
            <div className="pb-4">
              <Breadcrumbs items={[
                { label: t('courses.courses'), href: getUriWithOrg(orgslug, '/courses'), icon: <BookCopy size={14} /> },
                { label: course.name }
              ]} />
            </div>
            <div className="vz-course-heading flex flex-col items-start justify-between gap-3 pb-4 md:flex-row md:items-center">
              <div>
                <h1 className="vz-page-heading">{course.name}</h1>
                {parseCourseTags(course.tags).length > 0 && (
                  <div className="vz-course-tags mt-3 flex flex-wrap gap-1.5" aria-label={t('courses.tags', 'Теги')}>
                    {parseCourseTags(course.tags).map((tag: string) => (
                      <span key={tag} className="rounded-full border px-2.5 py-1 text-xs font-semibold" style={getTagColorStyle(tag, normalizeTagColors(course.extra_metadata?.tag_colors))}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="vz-hairline mt-4" />
              </div>
              <CourseShare
                courseName={course.name}
                courseUrl={getUriWithOrg(orgslug, `/course/${courseuuid}`)}
              />
            </div>

            <div className="vz-course-hero">
              <div className="vz-course-summary space-y-4">
                {(() => {
                  const hasVideo = Boolean(course.thumbnail_video);
                  const hasImage = Boolean(course.thumbnail_image);
                  const showVideo = hasVideo && (course.thumbnail_type === 'video' || (course.thumbnail_type === 'both' && activeThumbnailType === 'video'));
                  const showImage = hasImage && (course.thumbnail_type === 'image' || (course.thumbnail_type === 'both' && activeThumbnailType === 'image') || !course.thumbnail_type || !hasVideo);

                  if (showVideo && course.thumbnail_video) {
                    return (
                      <div className="vz-course-media vz-frame relative aspect-[3/2] w-full overflow-hidden">
                        {course.thumbnail_type === 'both' && hasVideo && hasImage && (
                          <div className="absolute top-3 right-3 z-10">
                            <div className="bg-black/20 backdrop-blur-sm rounded-lg p-1 flex space-x-1">
                              <button
                                onClick={() => setActiveThumbnailType('image')}
                                className={`flex items-center px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                                  activeThumbnailType === 'image'
                                    ? 'bg-white/90 text-gray-900 shadow-sm'
                                    : 'text-white/80 hover:text-white hover:bg-white/10'
                                }`}
                              >
                                <ImageIcon size={12} className="mr-1" />
                                {t('courses.image')}
                              </button>
                              <button
                                onClick={() => setActiveThumbnailType('video')}
                                className={`flex items-center px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                                  activeThumbnailType === 'video'
                                    ? 'bg-white/90 text-gray-900 shadow-sm'
                                    : 'text-white/80 hover:text-white hover:bg-white/10'
                                }`}
                              >
                                <Video size={12} className="mr-1" />
                                {t('activities.video')}
                              </button>
                            </div>
                          </div>
                        )}
                        <div className="w-full h-full">
                          <video
                            src={getCourseThumbnailMediaDirectory(
                              org?.org_uuid,
                              course?.course_uuid,
                              course?.thumbnail_video
                            )}
                            className="h-full w-full rounded-lg bg-black object-contain"
                            controls
                            autoPlay
                            muted
                            preload="metadata"
                            playsInline
                          />
                        </div>
                      </div>
                    );
                  } else if (showImage && course.thumbnail_image) {
                    return (
                      <div className="vz-course-media vz-frame relative aspect-[3/2] w-full overflow-hidden bg-gray-50">
                        <img
                          src={getCourseThumbnailMediaDirectory(org?.org_uuid, course?.course_uuid, course?.thumbnail_image)}
                          alt={course.name}
                          fetchPriority="high"
                          className="h-full w-full object-contain"
                        />
                        {course.thumbnail_type === 'both' && hasVideo && hasImage && (
                          <div className="absolute top-3 right-3 z-10">
                            <div className="bg-black/20 backdrop-blur-sm rounded-lg p-1 flex space-x-1">
                              <button
                                onClick={() => setActiveThumbnailType('image')}
                                className={`flex items-center px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                                  activeThumbnailType === 'image'
                                    ? 'bg-white/90 text-gray-900 shadow-sm'
                                    : 'text-white/80 hover:text-white hover:bg-white/10'
                                }`}
                              >
                                <ImageIcon size={12} className="mr-1" />
                                {t('courses.image')}
                              </button>
                              <button
                                onClick={() => setActiveThumbnailType('video')}
                                className={`flex items-center px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                                  activeThumbnailType === 'video'
                                    ? 'bg-white/90 text-gray-900 shadow-sm'
                                    : 'text-white/80 hover:text-white hover:bg-white/10'
                                }`}
                              >
                                <Video size={12} className="mr-1" />
                                {t('activities.video')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  } else {
                    return (
                      <div
                        className="vz-course-media vz-frame relative aspect-[3/2] w-full overflow-hidden bg-gray-50"
                      >
                        <img src="/empty_thumbnail.png" alt={course.name} className="h-full w-full object-contain" />
                      </div>
                    );
                  }
                })()}

                {(() => {
                  const cleanCourseUuid = course.course_uuid?.replace('course_', '');
                  const run = trailData?.runs?.find(
                    (run: any) => {
                      const cleanRunCourseUuid = run.course?.course_uuid?.replace('course_', '');
                      return cleanRunCourseUuid === cleanCourseUuid;
                    }
                  );
                  return run;
                })() && (
                  <ActivityIndicators
                    course_uuid={course.course_uuid}
                    orgslug={orgslug}
                    course={course}
                    trailData={trailData}
                  />
                )}

                <div className="course_metadata_left space-y-2">
                  <div className="">
                    <p className="vz-course-about py-5 whitespace-pre-line break-words text-pretty">{course.about}</p>
                  </div>
                </div>
              </div>

              <div id="course-access" className="course_metadata_right">
                <RevealGroup className="space-y-4">
                  <RevealItem>
                    <CoursesActions courseuuid={courseuuid} orgslug={orgslug} course={course} trailData={trailData} />
                  </RevealItem>

                  <RevealItem>
                    {/* Authors & Updates Box */}
                    <div className="vz-frame vz-frame-interactive overflow-hidden bg-white p-4">
                      <CourseProvider courseuuid={course.course_uuid}>
                        <CourseAuthors authors={course.authors} />
                      </CourseProvider>
                    </div>
                  </RevealItem>
                </RevealGroup>
              </div>
            </div>

            {(() => {
              const displayLearnings = learnings.filter((l: any) => {
                const text = typeof l === 'string' ? l : l?.text
                return text && text.trim() !== '' && text !== 'null'
              })
              if (displayLearnings.length === 0) return null
              return (
                <div className="w-full">
                  <div className="mb-2 pt-5">

                    <h2 className="vz-section-heading">{t('courses.what_you_will_learn')}</h2>
                    <div className="vz-hairline mt-4" />
                  </div>
                  <div className="vz-frame vz-frame-interactive overflow-hidden bg-white px-5 py-5 space-y-2">
                    {displayLearnings.map((learning: any) => {
                      const learningText = typeof learning === 'string' ? learning : learning.text
                      const learningEmoji = typeof learning === 'string' ? null : learning.emoji
                      const learningId = typeof learning === 'string' ? learning : learning.id || learning.text
                      return (
                        <div
                          key={learningId}
                          className="flex space-x-2 items-center font-semibold text-gray-500"
                        >
                          <div className="px-2 py-2 rounded-full">
                            {learningEmoji ? (
                              <span>{learningEmoji}</span>
                            ) : (
                              <Check className="text-gray-400" size={15} />
                            )}
                          </div>
                          <p>{learningText}</p>
                          {learning.link && (
                            <a
                              href={learning.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline text-sm"
                            >
                              <span className="sr-only">Link to {learningText}</span>
                              <ArrowRight size={14} />
                            </a>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            <div className="vz-course-section w-full mb-10">
              <div className="mb-3 pt-5">

                <h2 className="vz-section-heading">{t('courses.course_lessons')}</h2>
                <div className="vz-hairline mt-4" />
              </div>
              <div className="vz-curriculum">
                {(course.chapters ?? []).map((chapter: any, idx: number) => {
                  const isExpanded = expandedChapters[chapter.chapter_uuid] ?? (idx === 0); // Default to expanded for first chapter
                  return (
                    <div key={chapter.chapter_uuid || `chapter-${chapter.name}`} className="">
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-controls={`chapter-${chapter.chapter_uuid}`}
                        className="vz-chapter-toggle"
                        onClick={() => setExpandedChapters(prev => ({
                          ...prev,
                          [chapter.chapter_uuid]: !isExpanded
                        }))}
                      >
                        {/* Chevron on the far left, vertically centered with the title */}
                        <span className="flex flex-col justify-center mr-3 pt-1">
                          <svg 
                            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                        {/* Title and badge column */}
                        <span className="flex flex-col items-start w-full">
                          <span className="flex items-center flex-wrap mb-1 w-full min-w-0">
                            {/* Numbered badge */}
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-neutral-200 text-neutral-600 text-xs font-semibold mr-2 border border-neutral-300 flex-shrink-0">
                              {idx + 1}
                            </span>
                            <span className="vz-chapter-title min-w-0">{chapter.name}</span>
                            {chapter.is_locked && (
                              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-semibold">
                                <Lock size={10} />
                                {t('course.locked', 'Заблокировано')}
                              </span>
                            )}
                          </span>
                          <span className="flex items-center space-x-1 text-sm text-neutral-400 font-normal">
                            <Layers size={16} className="mr-1" />
                            <span>{chapter.activities.length} {t('activities.activities')}</span>
                          </span>
                        </span>
                      </button>
                      <div id={`chapter-${chapter.chapter_uuid}`} className={`transition-all duration-200 ${isExpanded ? 'block' : 'hidden'}`}>
                        <div className="">
                          {chapter.activities.map((activity: any) => {
                            const locked = !!activity.is_locked
                            const RowInner = (
                              <div className="flex space-x-3 items-center">
                                <div className="flex items-center">
                                  {locked ? (
                                    <div className="text-rose-400">
                                      <Lock size={14} className="stroke-[2]" />
                                    </div>
                                  ) : isActivityDone(activity) ? (
                                    <div className="relative cursor-pointer">
                                      <Square size={16} className="stroke-[2] text-teal-600" />
                                      <Check size={16} className="stroke-[2.5] text-teal-600 absolute top-0 left-0" />
                                    </div>
                                  ) : (
                                    <div className="text-neutral-300 cursor-pointer">
                                      <Square size={16} className="stroke-[2]" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col grow">
                                  <div className="flex flex-wrap items-center gap-2 w-full">
                                    <p className={`font-semibold transition-colors ${locked ? 'text-neutral-400' : 'text-neutral-600 group-hover:text-neutral-800'}`}>{activity.name}</p>
                                    {locked && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-semibold">
                                        <Lock size={10} />
                                        {t('course.locked', 'Заблокировано')}
                                      </span>
                                    )}
                                    {!locked && isActivityCurrent(activity) && (
                                      <div className="flex items-center space-x-1 text-primary bg-accent px-2 py-0.5 rounded-md text-xs font-medium">
                                        <span>{t('activities.current')}</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-1.5 mt-0.5 text-neutral-400">
                                    {getActivityTypeIcon(activity.activity_type, activity.activity_sub_type, 10)}
                                    <span className="text-xs font-medium">{getActivityTypeLabel(activity.activity_type, activity.activity_sub_type)}</span>
                                  </div>
                                </div>
                                <div className={`transition-colors ${locked ? 'text-neutral-200' : 'text-neutral-300 group-hover:text-neutral-400 cursor-pointer'}`}>
                                  <ArrowRight size={14} />
                                </div>
                              </div>
                            )

                            if (locked) {
                              return (
                                <div
                                  key={activity.activity_uuid}
                                  className="block activity-container px-4 py-4 cursor-not-allowed select-none"
                                  title={t('course.activity_locked_hint', 'Войдите или получите доступ в нужной группе, чтобы открыть этот материал.')}
                                >
                                  {RowInner}
                                </div>
                              )
                            }

                            return (
                              <Link
                                key={activity.activity_uuid}
                                href={
                                  getUriWithOrg(orgslug, '') +
                                  `/course/${courseuuid}/activity/${activity.activity_uuid.replace('activity_', '')}`
                                }
                                rel="noopener noreferrer"
                                prefetch={false}
                                className="block group activity-container transition-all duration-200 px-4 py-4"
                                onMouseEnter={() => handleActivityMouseEnter(activity)}
                              >
                                {RowInner}
                              </Link>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Community Section */}
            <Suspense fallback={<div className="animate-pulse h-48 bg-gray-100 rounded-lg mt-4" />}>
              <CourseCommunitySection courseUuid={course.course_uuid} orgslug={orgslug} />
            </Suspense>
          </GeneralWrapperStyled>

          {/* Mobile Actions Box */}
          {isMobile && (
            <CourseActionsMobile courseuuid={courseuuid} orgslug={orgslug} course={course} trailData={trailData} />
          )}
        </>
      )}
    </>
  )
}

export default CourseClient

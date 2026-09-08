import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithOrg } from '@services/config/config'
import { getOffersByResource } from '@services/payments/offers'
import { ArrowRight, LogIn } from 'lucide-react'
import { removeCourse, startCourse } from '@services/courses/activity'
import { revalidateTags, asArray } from '@services/utils/ts/requests'
import UserAvatar from '../../UserAvatar'
import { getUserAvatarMediaDirectory } from '@services/media/media'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { useLHAnalytics, AnalyticsEvent } from '@services/analytics'
import { useTranslation } from 'react-i18next'
import { getCourseResumeActivity, getCourseStartAction, selectFirstPublicOffer } from '@/lib/courses/startGate'

interface Author {
  user: {
    user_uuid: string
    avatar_image: string
    first_name: string
    last_name: string
    username: string
  }
  authorship: 'CREATOR' | 'CONTRIBUTOR' | 'MAINTAINER' | 'REPORTER'
  authorship_status: 'ACTIVE' | 'INACTIVE' | 'PENDING'
}

interface CourseRun {
  status: string
  course_id: string
}

interface Course {
  id: string
  course_uuid: string
  authors: Author[]
  trail?: {
    runs: CourseRun[]
  }
  chapters?: Array<{
    name: string
    activities: Array<{
      activity_uuid: string
      name: string
      activity_type: string
    }>
  }>
  is_paid?: boolean
  has_access?: boolean
}

interface CourseActionsMobileProps {
  courseuuid: string
  orgslug: string
  course: Course & {
    org_id: number
  }
  trailData?: any
}

// Component for displaying multiple authors
const MultipleAuthors = ({ authors }: { authors: Author[] }) => {
  if (!authors.length) return null
  const displayedAvatars = authors.slice(0, 3)
  const remainingCount = Math.max(0, authors.length - 3)
  
  // Avatar size for mobile
  const avatarSize = 36
  const borderSize = "border-2"

  return (
    <div className="flex items-center gap-3">
      <div className="flex -space-x-3 relative">
        {displayedAvatars.map((author, index) => (
          <div
            key={author.user.user_uuid}
            className="relative"
            style={{ zIndex: displayedAvatars.length - index }}
          >
            <UserAvatar
              border={borderSize}
              rounded='rounded-full'
              avatar_url={author.user.avatar_image ? getUserAvatarMediaDirectory(author.user.user_uuid, author.user.avatar_image) : ''}
              predefined_avatar={author.user.avatar_image ? undefined : 'empty'}
              width={avatarSize}
            />
          </div>
        ))}
        {remainingCount > 0 && (
          <div 
            className="relative"
            style={{ zIndex: 0 }}
          >
            <div 
              className="flex items-center justify-center bg-neutral-100 text-neutral-600 font-medium rounded-full border-2 border-white shadow-sm"
              style={{ 
                width: `${avatarSize}px`, 
                height: `${avatarSize}px`,
                fontSize: '12px'
              }}
            >
              +{remainingCount}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col">
        <span className="text-xs text-neutral-400 font-medium">
          {authors.length > 1 ? 'Авторы' : 'Автор'}
        </span>
        {authors.length === 1 ? (
          <span className="text-sm font-semibold text-neutral-800">
            {authors[0].user.first_name && authors[0].user.last_name 
              ? `${authors[0].user.first_name} ${authors[0].user.last_name}` 
              : `@${authors[0].user.username}`}
          </span>
        ) : (
          <span className="text-sm font-semibold text-neutral-800">
            {authors[0].user.first_name && authors[0].user.last_name
              ? `${authors[0].user.first_name} ${authors[0].user.last_name}`
              : `@${authors[0].user.username}`}
            {authors.length > 1 && ` & ${authors.length - 1} more`}
          </span>
        )}
      </div>
    </div>
  )
}

const CourseActionsMobile = ({ courseuuid, orgslug, course, trailData }: CourseActionsMobileProps) => {
  const router = useRouter()
  const session = useLHSession() as any
  const org = useOrg() as any
  const queryClient = useQueryClient()
  const { track } = useLHAnalytics('learner')
  const [isActionLoading, setIsActionLoading] = useState(false)
  // Clean up course UUID by removing 'course_' prefix if it exists
  const cleanCourseUuid = course.course_uuid?.replace('course_', '');
  const resourceUuid = cleanCourseUuid ? `course_${cleanCourseUuid}` : null;
  const { t } = useTranslation()

  const hasCourseAccess = course.is_paid === true ? course.has_access === true : true
  const isStarted = hasCourseAccess
    ? trailData?.runs?.find(
      (run: any) => {
        const cleanRunCourseUuid = run.course?.course_uuid?.replace('course_', '');
        return cleanRunCourseUuid === cleanCourseUuid;
      }
    ) ?? false
    : false;

  // Public endpoint — no auth needed, works for unauthenticated visitors too
  const { data: offersResult, isLoading } = useQuery({
    queryKey: ['offers', 'by-resource', org?.id, resourceUuid],
    queryFn: () => getOffersByResource(org.id, resourceUuid!),
    enabled: !!org && !!resourceUuid,
    staleTime: 60_000,
  });
  const linkedOffers: any[] = asArray(offersResult);
  const selectedOffer = selectFirstPublicOffer(linkedOffers);
  const courseAction = getCourseStartAction({
    course,
    isAuthenticated: !!session.data?.user,
    isStarted: !!isStarted,
    returnPath: `/course/${cleanCourseUuid}`,
    offer: selectedOffer,
  });

  const resumeActivity = getCourseResumeActivity(course, isStarted || null)
  const continueCourse = () => {
    if (!resumeActivity) return router.push(getUriWithOrg(orgslug, `/course/${cleanCourseUuid}`))
    router.push(getUriWithOrg(orgslug, '') + `/course/${cleanCourseUuid}/activity/${resumeActivity}`)
  }

  const handleCourseAction = async () => {
    if (courseAction.kind === 'login') {
      track(AnalyticsEvent.CourseSignupPrompted, {
        reason: 'unauthenticated',
        intended_action: 'start_course',
      })
      router.push(`${getUriWithOrg(orgslug, '/login')}?redirect=${encodeURIComponent(courseAction.returnPath)}`)
      return
    }

    if (courseAction.kind === 'offer') {
      track(AnalyticsEvent.CourseOfferCtaClicked, { offer_uuid: courseAction.offer.offer_uuid })
      router.push(getUriWithOrg(orgslug, `/store/offers/${courseAction.offer.offer_uuid}`))
      return
    }

    if (courseAction.kind === 'unavailable') return

    if (courseAction.kind === 'continue') {
      continueCourse()
      return
    }

    setIsActionLoading(true)
    try {
      await startCourse('course_' + courseuuid, orgslug, session.data?.tokens?.access_token)
      await revalidateTags(['courses'], orgslug)
      queryClient.invalidateQueries({ queryKey: queryKeys.trail.org(org.id) })
      track(AnalyticsEvent.CourseStarted, {
        course_uuid: cleanCourseUuid,
        total_activities: course.chapters?.reduce((acc: number, chapter: any) => acc + chapter.activities.length, 0) || 0,
        has_offers: linkedOffers.length > 0,
      })

      // Get the first activity from the first chapter
      const firstChapter = course.chapters?.[0]
      const firstActivity = firstChapter?.activities?.[0]

      if (firstActivity) {
        // Redirect to the first activity
        await revalidateTags(['activities'], orgslug)
        router.push(
          getUriWithOrg(orgslug, '') +
          `/course/${courseuuid}/activity/${firstActivity.activity_uuid.replace('activity_', '')}`
        )
      } else {
        router.refresh()
      }
    } catch (error) {
      console.error('Failed to perform course action:', error)
    } finally {
      setIsActionLoading(false)
      await revalidateTags(['courses'], orgslug)
    }
  }

  const handleLeaveCourse = async () => {
    setIsActionLoading(true)
    try {
      await removeCourse('course_' + courseuuid, orgslug, session.data?.tokens?.access_token)
      await revalidateTags(['courses'], orgslug)
      queryClient.invalidateQueries({ queryKey: queryKeys.trail.org(org.id) })
      track(AnalyticsEvent.CourseLeft, { course_uuid: cleanCourseUuid })
      router.refresh()
    } catch (error) {
      console.error('Failed to leave course:', error)
    } finally {
      setIsActionLoading(false)
      await revalidateTags(['courses'], orgslug)
    }
  }

  if (isLoading) {
    return <div className="animate-pulse h-16 bg-gray-100 rounded-lg mt-4 mb-8" />
  }

  if (courseAction.kind === 'unavailable') {
    return (
      <div className="bg-white/90 backdrop-blur-sm shadow-md shadow-gray-300/25 outline outline-1 outline-neutral-200/40 rounded-lg overflow-hidden p-4 my-6 mx-2">
        <p className="text-sm text-neutral-600">{t('courses.access_unavailable', 'Access unavailable')}</p>
      </div>
    )
  }

  // Filter active authors and sort by role priority
  const sortedAuthors = [...course.authors]
    .filter(author => author.authorship_status === 'ACTIVE')
    .sort((a, b) => {
      const rolePriority: Record<string, number> = {
        'CREATOR': 0,
        'MAINTAINER': 1,
        'CONTRIBUTOR': 2,
        'REPORTER': 3
      };
      return rolePriority[a.authorship] - rolePriority[b.authorship];
    });

  return (
    <div className="bg-white/90 backdrop-blur-sm shadow-md shadow-gray-300/25 outline outline-1 outline-neutral-200/40 rounded-lg overflow-hidden p-4 my-6 mx-2">
      <div className="flex flex-col space-y-4">
        <MultipleAuthors authors={sortedAuthors} />
        
        <button
            onClick={handleCourseAction}
            disabled={isActionLoading}
            aria-label={courseAction.kind === 'continue' ? t('courses.continue_course', 'Продолжить курс') : t('courses.start_course')}
            className="w-full py-2 px-4 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 bg-neutral-900 text-white hover:bg-neutral-800 disabled:bg-neutral-700"
          >
            {isActionLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : courseAction.kind === 'continue' ? (
              <>
                <ArrowRight className="w-4 h-4" />
                {t('courses.continue_course', 'Продолжить курс')}
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                {t('courses.start_course')}
              </>
            )}
          </button>
          {isStarted && (
            <button
              type="button"
              onClick={handleLeaveCourse}
              disabled={isActionLoading}
              className="w-full border-t border-neutral-200 pt-3 text-sm font-medium text-red-600 transition-colors hover:text-red-700 disabled:opacity-50"
            >
              {t('courses.leave_course')}
            </button>
          )}
      </div>
    </div>
  )
}

export default CourseActionsMobile

import React, { useState } from 'react'
import { removeCourse, startCourse } from '@services/courses/activity'
import { revalidateTags, asArray } from '@services/utils/ts/requests'
import { useRouter } from 'next/navigation'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { getOffersByResource } from '@services/payments/offers'
import { UserPen, ClockIcon, ArrowRight } from 'lucide-react'
import { applyForContributor } from '@services/courses/courses'
import toast from 'react-hot-toast'
import { useContributorStatus } from '../../../../hooks/useContributorStatus'
import CourseProgress from '../CourseProgress/CourseProgress'
import { useOrg } from '@components/Contexts/OrgContext'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { useTranslation } from 'react-i18next'
import { useLHAnalytics, AnalyticsEvent } from '@services/analytics'
import { getCourseResumeActivity, getCourseStartAction, selectFirstPublicOffer } from '@/lib/courses/startGate'

interface CourseRun {
  status: string
  course_id: string
  steps: Array<{
    activity_id: string
    complete: boolean
  }>
}

interface Course {
  id: string
  course_uuid: string
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
  open_to_contributors?: boolean
  is_paid?: boolean
  has_access?: boolean
}

interface CourseActionsProps {
  courseuuid: string
  orgslug: string
  course: Course & {
    org_id: number
  }
  trailData?: any
}

function CoursesActions({ courseuuid, orgslug, course, trailData }: CourseActionsProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const session = useLHSession() as any
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [isContributeLoading, setIsContributeLoading] = useState(false)
  const { contributorStatus, refetch } = useContributorStatus(courseuuid)
  const [isProgressOpen, setIsProgressOpen] = useState(false)
  const org = useOrg() as any
  const queryClient = useQueryClient()
  const { track } = useLHAnalytics('learner')

  // Clean up course UUID by removing 'course_' prefix if it exists
  const cleanCourseUuid = course.course_uuid?.replace('course_', '');
  const resourceUuid = cleanCourseUuid ? `course_${cleanCourseUuid}` : null;

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
    const loadingToast = toast.loading(
      t('courses.start_course') + '...'
    )

    try {
      await startCourse('course_' + courseuuid, orgslug, session.data?.tokens?.access_token)
      if (org?.id) queryClient.invalidateQueries({ queryKey: queryKeys.trail.org(org.id) })
      track(AnalyticsEvent.CourseStarted, {
        course_uuid: cleanCourseUuid,
        total_activities: course.chapters?.reduce((acc: number, chapter: any) => acc + chapter.activities.length, 0) || 0,
        has_offers: linkedOffers.length > 0,
      })
      toast.success(t('courses.start_course_success'), { id: loadingToast })

      // Get the first activity from the first chapter
      const firstChapter = course.chapters?.[0]
      const firstActivity = firstChapter?.activities?.[0]

      if (firstActivity) {
        // Redirect to the first activity
        router.push(
          getUriWithOrg(orgslug, '') +
          `/course/${courseuuid}/activity/${firstActivity.activity_uuid.replace('activity_', '')}`
        )
      }
    } catch (error) {
      console.error('Failed to perform course action:', error)
      toast.error(
        isStarted
          ? t('courses.leave_course_error')
          : t('courses.start_course_error'),
        { id: loadingToast }
      )
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleApplyToContribute = async () => {
    if (!session.data?.user) {
      router.push(getUriWithOrg(orgslug, '/signup'))
      return
    }

    setIsContributeLoading(true)
    const loadingToast = toast.loading(t('courses.submitting_contributor_application'))

    try {
      const data = {
        message: "I would like to contribute to this course."
      }

      await applyForContributor('course_' + courseuuid, data, session.data?.tokens?.access_token)
      await revalidateTags(['courses'], orgslug)
      await refetch()
      track(AnalyticsEvent.ContributorApplicationSubmitted, { course_uuid: cleanCourseUuid })
      toast.success(t('courses.contributor_application_success'), { id: loadingToast })
    } catch (error) {
      console.error('Failed to apply as contributor:', error)
      toast.error(t('courses.contributor_application_error'), { id: loadingToast })
    } finally {
      setIsContributeLoading(false)
    }
  }

  const handleLeaveCourse = async () => {
    setIsActionLoading(true)
    const loadingToast = toast.loading(t('courses.leave_course') + '...')
    try {
      await removeCourse('course_' + courseuuid, orgslug, session.data?.tokens?.access_token)
      if (org?.id) queryClient.invalidateQueries({ queryKey: queryKeys.trail.org(org.id) })
      track(AnalyticsEvent.CourseLeft, { course_uuid: cleanCourseUuid })
      toast.success(t('courses.leave_course_success'), { id: loadingToast })
    } catch (error) {
      console.error('Failed to leave course:', error)
      toast.error(t('courses.leave_course_error'), { id: loadingToast })
    } finally {
      setIsActionLoading(false)
    }
  }

  const renderActionButton = (action: 'start' | 'continue') => {
    return (
      <>
        <span>{action === 'start' ? t('courses.start_course') : t('courses.continue_course', 'Продолжить курс')}</span>
        <ArrowRight className="w-5 h-5" />
      </>
    );
  };

  const renderContributorButton = () => {
    if (contributorStatus === 'INACTIVE' || course.open_to_contributors !== true) {
      return null;
    }

    if (!session.data?.user) {
      return (
        <button
          onClick={() => router.push(getUriWithOrg(orgslug, '/signup'))}
          aria-label={t('auth.sign_up_to_contribute')}
          className="w-full bg-white text-neutral-700 border border-neutral-200 py-3 rounded-lg nice-shadow font-semibold hover:bg-neutral-50 transition-colors flex items-center justify-center gap-2 mt-3 cursor-pointer"
        >
          <UserPen className="w-5 h-5" />
          {t('auth.authenticate_to_contribute')}
        </button>
      );
    }

    if (contributorStatus === 'ACTIVE') {
      return (
        <div className="w-full bg-green-50 text-green-700 border border-green-200 py-3 rounded-lg nice-shadow font-semibold flex items-center justify-center gap-2 mt-3">
          <UserPen className="w-5 h-5" />
          {t('courses.you_are_contributor')}
        </div>
      );
    }

    if (contributorStatus === 'PENDING') {
      return (
        <div className="w-full bg-amber-50 text-amber-700 border border-amber-200 py-3 rounded-lg nice-shadow font-semibold flex items-center justify-center gap-2 mt-3">
          <ClockIcon className="w-5 h-5" />
          {t('courses.contributor_application_pending')}
        </div>
      );
    }

    return (
      <button
        onClick={handleApplyToContribute}
        disabled={isContributeLoading}
        aria-label={t('courses.apply_to_contribute')}
        className="w-full bg-white text-neutral-700 py-3 rounded-lg nice-shadow font-semibold hover:bg-neutral-50 transition-colors flex items-center justify-center gap-2 mt-3 cursor-pointer disabled:cursor-not-allowed"
      >
        {isContributeLoading ? (
          <div className="w-5 h-5 border-2 border-neutral-700 border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <UserPen className="w-5 h-5" />
            {t('courses.apply_to_contribute')}
          </>
        )}
      </button>
    );
  };

  const renderProgressSection = () => {
    const totalActivities = course.chapters?.reduce((sum, chapter) => sum + chapter.activities.length, 0) || 0
    // Existing trail contract: only completed steps contribute to this display.
    const run = trailData?.runs?.find((item: { course?: { course_uuid?: string } }) =>
      item.course?.course_uuid?.replace('course_', '') === cleanCourseUuid)
    const completedActivities = run?.steps?.filter((step: { complete: boolean }) => step.complete)?.length || 0
    const progressPercentage = totalActivities > 0 ? Math.min(100, Math.round(completedActivities / totalActivities * 100)) : 0

    return (
      <div className="vz-access-progress">
        <div className="flex items-center justify-between gap-3">
          <strong>{isStarted ? t('courses.course_progress') : t('courses.ready_to_begin')}</strong>
          {isStarted && <span className="font-mono text-sm text-muted-foreground">{progressPercentage}%</span>}
        </div>
        {isStarted ? (
          <>
            <div className="vz-progress-track" role="progressbar" aria-label={t('courses.course_progress')} aria-valuenow={progressPercentage} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${progressPercentage}%` }} />
            </div>
            <button
              type="button"
              className="text-left text-sm text-muted-foreground hover:text-foreground"
              onClick={() => {
                track(AnalyticsEvent.CourseProgressViewed, {
                  course_uuid: cleanCourseUuid, completed_activities: completedActivities,
                  total_activities: totalActivities, progress_percentage: progressPercentage,
                })
                setIsProgressOpen(true)
              }}
              aria-label={t('courses.view_course_progress', { completed: completedActivities, total: totalActivities })}
            >{t('courses.completed_of', { completed: completedActivities, total: totalActivities })}</button>
          </>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">{t('courses.start_learning_journey', { count: totalActivities })}</p>
        )}
      </div>
    )
  }

  if (isLoading) {
    return <div className="animate-pulse h-20 bg-gray-100 rounded-lg nice-shadow" />
  }

  if (courseAction.kind === 'unavailable') {
    return (
      <div className="vz-access-panel">
        <p className="text-sm text-neutral-600">{t('courses.access_unavailable', 'Access unavailable')}</p>
      </div>
    )
  }

  return (
    <div className="vz-access-panel">
      <div className="space-y-4">
        {/* Progress Section */}
        {renderProgressSection()}

        {/* Start/Leave Course Button */}
        <button
          onClick={handleCourseAction}
          disabled={isActionLoading}
          aria-label={isStarted ? t('courses.continue_course', 'Продолжить курс') : t('courses.start_course')}
          className="vz-primary w-full"
        >
          {isActionLoading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            renderActionButton(isStarted ? 'continue' : 'start')
          )}
        </button>

        {/* Contributor Button */}
        {renderContributorButton()}

        {isStarted && (
          <button
            type="button"
            onClick={handleLeaveCourse}
            disabled={isActionLoading}
            className="w-full border-t border-neutral-200 pt-4 text-sm font-medium text-red-600 transition-colors hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('courses.leave_course')}
          </button>
        )}

        {/* Course Progress Modal */}
        <CourseProgress
          course={course}
          orgslug={orgslug}
          isOpen={isProgressOpen}
          onClose={() => setIsProgressOpen(false)}
          trailData={trailData}
        />
      </div>
    </div>
  )
}

export default CoursesActions

'use client'
import CreateCourseModal from '@components/Objects/Modals/Course/Create/CreateCourse'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import React, { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import CourseThumbnail from '@components/Objects/Thumbnails/CourseThumbnail'
import NewCourseButton from '@components/Objects/StyledElements/Buttons/NewCourseButton'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { useTranslation } from 'react-i18next'
import { BookCopy, Search, X, Users, Info, LogIn } from 'lucide-react'
import Link from 'next/link'
import { getUriWithOrg } from '@services/config/config'
import FeatureGate from '@components/Dashboard/Shared/FeatureGate/FeatureGate'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { searchMatchesAny } from '@/lib/search/normalize'
import { getUserGroups, getUserGroupResources } from '@services/usergroups/usergroups'
import { useCourses } from '@/hooks/queries/useCourses'
import { useLHAnalytics, AnalyticsEvent } from '@services/analytics'
import { asArray } from '@services/utils/ts/requests'
import { RevealGroup, RevealItem } from '@components/Objects/Motion/Reveal'
import { groupCatalogCourses } from '@/lib/catalog/sections'

interface CourseProps {
  orgslug: string
}

function Courses(props: CourseProps) {
  const { t } = useTranslation()
  const orgslug = props.orgslug
  const searchParams = useSearchParams()
  const isCreatingCourse = searchParams.get('new') ? true : false
  const [newCourseModal, setNewCourseModal] = React.useState(isCreatingCourse)
  const { isAdmin: isUserAdmin } = useAdminStatus()
  const org = useOrg() as any
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const isAuthenticated = session?.status === 'authenticated'
  const { track } = useLHAnalytics('learner')
  const { data: coursesData, isLoading: coursesLoading } = useCourses(orgslug)

  const allCourses = coursesData || []

  // Usergroup filter — shown only when the org's plan actually includes
  // usergroups (a standard+ feature per the backend), via resolved features.
  const usergroupsAvailable = org?.config?.config?.resolved_features?.usergroups?.enabled ?? false
  const [usergroups, setUsergroups] = useState<any[]>([])
  const [selectedUsergroupId, setSelectedUsergroupId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('lh_course_usergroup_filter') || ''
    }
    return ''
  })
  const [usergroupResourceUuids, setUsergroupResourceUuids] = useState<Set<string> | null>(null)
  const [showUsergroupInfo, setShowUsergroupInfo] = useState(false)

  // Fetch usergroups
  useEffect(() => {
    if (!usergroupsAvailable || !access_token || !org?.id) return
    getUserGroups(org?.id, access_token)
      .then((res: any) => {
        const list = asArray(res)
        setUsergroups(list)
        if (selectedUsergroupId && !list.some((ug: any) => String(ug.id) === selectedUsergroupId)) {
          setSelectedUsergroupId('')
          localStorage.removeItem('lh_course_usergroup_filter')
        }
      })
      .catch(() => setUsergroups([]))
  }, [usergroupsAvailable, access_token, org?.id])

  // Fetch resource UUIDs for selected usergroup
  useEffect(() => {
    if (!selectedUsergroupId || !access_token || !org?.id) {
      setUsergroupResourceUuids(null)
      return
    }
    getUserGroupResources(selectedUsergroupId, org?.id, access_token)
      .then((res: any) => {
        const uuids = asArray(res)
        setUsergroupResourceUuids(new Set(uuids))
      })
      .catch(() => setUsergroupResourceUuids(null))
  }, [selectedUsergroupId, access_token, org?.id])

  const handleUsergroupChange = (value: string) => {
    setSelectedUsergroupId(value)
    if (value) {
      localStorage.setItem('lh_course_usergroup_filter', value)
    } else {
      localStorage.removeItem('lh_course_usergroup_filter')
    }
  }

  // Search state
  const [searchQuery, setSearchQuery] = useState('')

  // Filter courses based on search and usergroup
  const filteredCourses = useMemo(() => {
    let courses = allCourses

    // Usergroup filter
    if (usergroupResourceUuids) {
      courses = courses.filter((course: any) => usergroupResourceUuids.has(course.course_uuid))
    }

    // Search filter
    if (searchQuery.trim()) {
      courses = courses.filter((course: any) =>
        searchMatchesAny([course.name, course.description, course.tags], searchQuery)
      )
    }

    return courses
  }, [allCourses, searchQuery, usergroupResourceUuids])

  const catalogGroups = useMemo(
    () => groupCatalogCourses(filteredCourses, org?.config?.config),
    [filteredCourses, org?.config?.config],
  )

  // Track non-empty searches (debounced so we don't fire on every keystroke)
  useEffect(() => {
    const query = searchQuery.trim()
    if (!query) return
    const timer = setTimeout(() => {
      track(AnalyticsEvent.CourseSearched, {
        results_count: filteredCourses.length,
        total_courses: allCourses.length,
      })
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery, filteredCourses.length, allCourses.length, track])

  async function closeNewCourseModal() {
    setNewCourseModal(false)
  }

  if (coursesLoading && !coursesData) {
    return (
      <div className="w-full animate-pulse">
        <GeneralWrapperStyled>
          <div className="flex flex-col space-y-2 mb-2">
            {/* Header row: title + button placeholder */}
            <div className="flex items-center justify-between mb-2">
              <div className="h-7 bg-gray-200 rounded w-28" />
              <div className="h-9 bg-gray-200 rounded-lg w-32" />
            </div>
            {/* Search bar placeholder */}
            <div className="h-10 bg-gray-200 rounded-lg w-full sm:w-80 mb-4" />
            {/* Course card grid */}
            <div className="vz-course-grid">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-xl overflow-hidden">
                  {/* Thumbnail area */}
                  <div className="bg-gray-200 w-full h-40 rounded-xl" />
                  {/* Card body */}
                  <div className="pt-3 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GeneralWrapperStyled>
      </div>
    )
  }

  return (
    <FeatureGate feature="courses" orgslug={orgslug} context="public">
    <div className="w-full">
      <GeneralWrapperStyled>
        <div className="flex flex-col space-y-2 mb-2">
          <div className="vz-catalog-header">
            <header>
              <h1 className="vz-page-heading">{t('courses.courses')}</h1>
              <p className="vz-page-intro">{t('design.catalog_intro')}</p>
            </header>
            <AuthenticatedClientElement
              checkMethod="roles"
              action="create"
              ressourceType="courses"
              orgId={org?.id}
            >
              <Modal
                isDialogOpen={newCourseModal}
                onOpenChange={setNewCourseModal}
                minHeight="md"
                minWidth="lg"
                dialogContent={
                  <CreateCourseModal
                    closeModal={closeNewCourseModal}
                    orgslug={orgslug}
                  />
                }
                dialogTitle={t('courses.create_course')}
                dialogDescription={t('courses.create_new_course')}
                dialogTrigger={
                  <button>
                    <NewCourseButton />
                  </button>
                }
              />
            </AuthenticatedClientElement>
          </div>

          {/* Search and Usergroup Filter */}
          {allCourses.length > 0 && (
            <div className="vz-catalog-tools">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label={t('courses.search_courses')}
                  placeholder={t('courses.search_courses')}
                  className="vz-field w-full pl-10 pr-10 py-2.5 text-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    aria-label={t('design.clear_search')}
                    className="absolute right-0 top-1/2 -translate-y-1/2 flex size-11 items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Usergroup Filter */}
              {usergroupsAvailable && usergroups.length > 0 && (
                <div className="relative flex items-center gap-1.5">
                  <div className="relative">
                    <Users className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                    <select
                      aria-label={t('courses.usergroup_filter.all_courses')}
                      value={selectedUsergroupId}
                      onChange={(e) => handleUsergroupChange(e.target.value)}
                      className="vz-field pl-8 pr-8 py-2.5 text-sm appearance-none cursor-pointer min-w-[160px]"
                    >
                      <option value="">{t('courses.usergroup_filter.all_courses')}</option>
                      {usergroups.map((ug: any) => (
                        <option key={ug.id} value={String(ug.id)}>
                          {ug.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => setShowUsergroupInfo(!showUsergroupInfo)}
                    aria-label={t('courses.usergroup_filter.info_title')}
                    aria-expanded={showUsergroupInfo}
                    className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors rounded-md hover:bg-gray-100"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                  {showUsergroupInfo && (
                    <div className="absolute top-full left-0 mt-2 z-50 w-72 bg-white nice-shadow rounded-lg p-3 border border-gray-100">
                      <p className="text-xs font-semibold text-gray-700 mb-1">{t('courses.usergroup_filter.info_title')}</p>
                      <p className="text-xs text-gray-500 leading-relaxed">{t('courses.usergroup_filter.info_description')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Search Results Info */}
          {searchQuery && (
            <div className="mb-2 text-sm text-gray-500">
              {t('courses.search_results', { count: filteredCourses.length, query: searchQuery })}
            </div>
          )}

          <div>
            {catalogGroups.map(({ section, courses }) => (
              <section key={section?.key ?? 'other'} className="mb-12">
                <div className="vz-section-title">
                  <h2 className="vz-section-heading">{section?.title ?? t('courses.other', 'Other')}</h2>
                  <span className="vz-section-count">{courses.length}</span>
                </div>
                <RevealGroup className="vz-course-grid">
                  {courses.map((course: any, index: number) => (
                    <RevealItem key={course.course_uuid} className="flex h-full">
                      <CourseThumbnail course={course} orgslug={orgslug} isPriority={index < 3} />
                    </RevealItem>
                  ))}
                </RevealGroup>
              </section>
            ))}
            {filteredCourses.length === 0 && searchQuery && (
              <RevealItem className="col-span-full flex flex-col items-center justify-center px-4 py-12">
                <Search className="w-12 h-12 text-gray-300 mb-4" />
                <h2 className="text-xl font-semibold text-gray-600 mb-2">
                  {t('courses.no_search_results')}
                </h2>
                <p className="text-gray-400">
                  {t('courses.try_different_search')}
                </p>
              </RevealItem>
            )}
            {filteredCourses.length === 0 && !searchQuery && allCourses.length > 0 && (
              <RevealItem className="col-span-full flex flex-col items-center justify-center px-4 py-12">
                <BookCopy className="w-12 h-12 text-gray-300 mb-4" />
                <h2 className="text-xl font-semibold text-gray-600 mb-2">
                  {t('courses.no_courses')}
                </h2>
                <p className="text-gray-400">
                  {t('courses.no_courses_available')}
                </p>
              </RevealItem>
            )}
            {allCourses.length === 0 && !searchQuery && (
              <RevealItem className="col-span-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-100 bg-gray-50/30 px-4 py-12">
                <div className="p-4 bg-white rounded-full nice-shadow mb-4">
                  {isAuthenticated ? (
                    <BookCopy className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
                  ) : (
                    <LogIn className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
                  )}
                </div>
                <h1 className="text-xl font-bold text-gray-600 mb-2">
                  {isAuthenticated
                    ? t('courses.no_courses')
                    : t('courses.sign_in_to_see_courses', 'Log in to see your courses')}
                </h1>
                <p className="text-md text-gray-400 mb-6 text-center max-w-xs">
                  {!isAuthenticated ? (
                    t(
                      'courses.sign_in_to_see_courses_description',
                      'Courses in this academy may only be visible once you are signed in.',
                    )
                  ) : isUserAdmin ? (
                    t('courses.create_courses_placeholder')
                  ) : (
                    t('courses.no_courses_available')
                  )}
                </p>
                {/* Keep the established sign-in affordance for an anonymous empty catalog. */}
                {!isAuthenticated && (
                  <Link
                    href={getUriWithOrg(orgslug, '/login')}
                    className="vz-primary"
                  >
                    <LogIn size={16} />
                    {t('auth.sign_in', 'Sign in')}
                  </Link>
                )}
                {isAuthenticated && isUserAdmin && (
                  <div className="mt-4">
                    <AuthenticatedClientElement
                      action="create"
                      ressourceType="courses"
                      checkMethod="roles"
                      orgId={org?.id}
                    >
                      <button onClick={() => setNewCourseModal(true)}>
                        <NewCourseButton />
                      </button>
                    </AuthenticatedClientElement>
                  </div>
                )}
              </RevealItem>
            )}
          </div>
        </div>
      </GeneralWrapperStyled>
    </div>
    </FeatureGate>
  )
}

export default Courses

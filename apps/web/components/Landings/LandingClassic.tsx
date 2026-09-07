'use client'

import React from 'react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import TypeOfContentTitle from '@components/Objects/StyledElements/Titles/TypeOfContentTitle'
import CourseThumbnail from '@components/Objects/Thumbnails/CourseThumbnail'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import NewCourseButton from '@components/Objects/StyledElements/Buttons/NewCourseButton'
import ContentPlaceHolderIfUserIsNotAdmin from '@components/Objects/ContentPlaceHolder'
import Link from 'next/link'
import { getUriWithOrg } from '@services/config/config'
import { useTranslation } from 'react-i18next'
import { BookCopy } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { Reveal, RevealGroup, RevealItem } from '@components/Objects/Motion/Reveal'

interface LandingClassicProps {
  courses: any[]
  orgslug: string
  org_id: string | number
}

function LandingClassic({ courses, orgslug, org_id }: LandingClassicProps) {
  const { t } = useTranslation()
  const session = useLHSession() as any
  const isAuthenticated = session?.status === 'authenticated'

  // The home landing is the public catalog. The API already returns the full
  // published projection (including gated courses), so never truncate it here.
  const displayedCourses = courses.filter((course: any) => course.published !== false)

  return (
    <div className="w-full">
      <GeneralWrapperStyled>
        {/* Courses */}
        <div className="flex flex-col space-y-2">
          <Reveal className="flex items-center justify-between" direction="none">
            <div>
              <span className="mono-label">ОРГАНИЗАЦИЯ / КАТАЛОГ КУРСОВ</span>
              <TypeOfContentTitle title={t('courses.courses')} type="cou" />
              <div className="vz-hairline" />
            </div>
            <AuthenticatedClientElement
              ressourceType="courses"
              action="create"
              checkMethod="roles"
              orgId={org_id}
            >
              <Link href={getUriWithOrg(orgslug, '/courses?new=true')}>
                <NewCourseButton />
              </Link>
            </AuthenticatedClientElement>
          </Reveal>
          <RevealGroup className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {displayedCourses.map((course: any) => (
              <RevealItem key={course.course_uuid} className="flex">
                <CourseThumbnail course={course} orgslug={orgslug} />
              </RevealItem>
            ))}
            {displayedCourses.length === 0 && (
              <div className="col-span-full flex flex-col justify-center items-center py-12 px-4 border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/30">
                <div className="p-4 bg-white rounded-full nice-shadow mb-4">
                  <BookCopy className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
                </div>
                <h1 className="text-xl font-bold text-gray-600 mb-2">
                  {t('courses.no_courses')}
                </h1>
                <p className="text-md text-gray-400 mb-6 text-center max-w-xs">
                  {isAuthenticated ? (
                    <ContentPlaceHolderIfUserIsNotAdmin text={t('courses.create_courses_placeholder')} />
                  ) : (
                    t('courses.no_courses_available')
                  )}
                </p>
              </div>
            )}
          </RevealGroup>
        </div>
      </GeneralWrapperStyled>
    </div>
  )
}

export default LandingClassic

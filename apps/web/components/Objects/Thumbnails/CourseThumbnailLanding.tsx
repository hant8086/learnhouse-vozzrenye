'use client'
import { useOrg } from '@components/Contexts/OrgContext'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import { getUriWithOrg } from '@services/config/config'
import { deleteCourseFromBackend } from '@services/courses/courses'
import { getCourseThumbnailMediaDirectory } from '@services/media/media'
import { revalidateTags } from '@services/utils/ts/requests'
import { BookMinus, FilePenLine, Settings2, MoreVertical } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React from 'react'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import { useTranslation } from 'react-i18next'
import { getTagColorStyle, normalizeTagColors, parseCourseTags } from '@/lib/courses/tagColors'

type Course = {
  course_uuid: string
  name: string
  description: string
  thumbnail_image: string
  org_id: string | number
  update_date: string
  tags?: string | null
  extra_metadata?: Record<string, unknown> | null
  is_paid?: boolean
  authors?: Array<{
    user: {
      id: string
      user_uuid: string
      avatar_image: string
      first_name: string
      last_name: string
      username: string
    }
    authorship: 'CREATOR' | 'CONTRIBUTOR' | 'MAINTAINER' | 'REPORTER'
    authorship_status: 'ACTIVE' | 'INACTIVE' | 'PENDING'
  }>
}

type PropsType = {
  course: Course
  orgslug: string
  customLink?: string
}

interface AdminEditOptionsProps {
  course: Course
  orgslug: string
  deleteCourse: () => Promise<void>
}

export const removeCoursePrefix = (course_uuid: string) => course_uuid.replace('course_', '')

const AdminEditOptions: React.FC<AdminEditOptionsProps> = ({ course, orgslug, deleteCourse }) => {
  const { t } = useTranslation()
  return (
    <AuthenticatedClientElement
      action="update"
      ressourceType="courses"
      checkMethod="roles"
      orgId={course.org_id}
    >
      <div className="absolute top-2 right-2 z-20">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 bg-white rounded-full hover:bg-gray-100 transition-colors shadow-md">
              <MoreVertical size={20} className="text-gray-700" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link prefetch href={getUriWithOrg(orgslug, `/dash/courses/course/${removeCoursePrefix(course.course_uuid)}/content`)}>
                <FilePenLine className="mr-2 h-4 w-4" /> {t('courses.edit_content')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link prefetch href={getUriWithOrg(orgslug, `/dash/courses/course/${removeCoursePrefix(course.course_uuid)}/general`)}>
                <Settings2 className="mr-2 h-4 w-4" /> {t('common.settings')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <ConfirmationModal
                confirmationButtonText={t('courses.delete_course')}
                confirmationMessage={t('courses.delete_course_confirm')}
                dialogTitle={t('courses.delete_course_title', { name: course.name })}
                dialogTrigger={
                  <button className="w-full text-left flex items-center px-2 py-1 rounded-md text-sm bg-rose-500/10 hover:bg-rose-500/20 transition-colors text-red-600">
                    <BookMinus className="mr-4 h-4 w-4" /> {t('courses.delete_course')}
                  </button>
                }
                functionToExecute={deleteCourse}
                status="warning"
              />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </AuthenticatedClientElement>
  )
}

const CourseThumbnailLanding: React.FC<PropsType> = ({ course, orgslug, customLink }) => {
  const { t } = useTranslation()
  const router = useRouter()
  const org = useOrg() as any
  const session = useLHSession() as any
  const queryClient = useQueryClient()


  const deleteCourse = async () => {
    const toastId = toast.loading(t('courses.deleting_course'))
    try {
      await deleteCourseFromBackend(course.course_uuid, session.data?.tokens?.access_token)
      await revalidateTags(['courses'], orgslug)
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.list(orgslug) })
      toast.success(t('courses.course_deleted_success'))
      router.refresh()
    } catch {
      toast.error(t('courses.course_deleted_error'))
    } finally {
      toast.dismiss(toastId)
    }
  }

  const thumbnailImage = course.thumbnail_image
    ? getCourseThumbnailMediaDirectory(org?.org_uuid, course.course_uuid, course.thumbnail_image)
    : '/empty_thumbnail.png'
  const courseTags = parseCourseTags(course.tags)
  const tagColors = normalizeTagColors(course.extra_metadata?.tag_colors)

  return (
    <div className="vz-course-card relative flex w-full flex-col overflow-hidden bg-card sm:min-w-[280px]">
      <AdminEditOptions
        course={course}
        orgslug={orgslug}
        deleteCourse={deleteCourse}
      />
      <Link prefetch={false} href={customLink ? customLink : getUriWithOrg(orgslug, `/course/${removeCoursePrefix(course.course_uuid)}`)}>
        <div className="vz-course-cover w-full aspect-[3/2] overflow-hidden bg-muted">
          <img src={thumbnailImage} alt={course.name} className="h-full w-full object-contain" />
        </div>
      </Link>
      <div className='vz-course-body flex flex-col w-full p-4 space-y-3'>
        <div className="space-y-2">
          <h2 className="vz-course-title font-semibold text-foreground leading-tight text-base line-clamp-2">{course.name}</h2>
          {course.is_paid === true && (
            <span className="inline-flex w-fit rounded-full bg-gray-900 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
              {t('courses.pro', 'Pro')}
            </span>
          )}
          <p className='vz-course-description text-sm text-muted-foreground leading-relaxed line-clamp-2'>{course.description}</p>
          {courseTags.length > 0 && (
            <div className="vz-course-tags flex flex-wrap gap-1" aria-label={t('courses.tags')}>
              {courseTags.map((tag) => (
                <span key={tag} style={getTagColorStyle(tag, tagColors)} className="rounded-full border px-2 py-0.5 text-[9px] font-medium">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        
        <div className="vz-course-meta flex flex-wrap items-center justify-between gap-2">
          {course.update_date && (
            <div className="inline-flex items-center">
              <span className="vz-course-date">
                {t('common.updated')} {new Date(course.update_date).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          )}
          

        </div>

        <Link 
          prefetch 
          href={customLink ? customLink : getUriWithOrg(orgslug, `/course/${removeCoursePrefix(course.course_uuid)}`)}
          className="vz-secondary w-full"
        >
          {t('courses.start_learning')}
        </Link>
      </div>
    </div>
  )
}

export default CourseThumbnailLanding

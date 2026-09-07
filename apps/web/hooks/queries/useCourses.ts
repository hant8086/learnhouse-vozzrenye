'use client'

import { useQuery } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { queryKeys } from '@lib/query/keys'
import { getAllOrgCourses, getCourseMetadata } from '@services/courses/courses'

export function useCourses(orgSlug: string) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const identity = session?.status === 'authenticated'
    ? String(session?.data?.user?.user_uuid ?? session?.data?.user?.id ?? 'authenticated')
    : 'anonymous'

  return useQuery({
    queryKey: queryKeys.courses.list(orgSlug, identity),
    queryFn: () => getAllOrgCourses(orgSlug, {}, accessToken),
    enabled: !!orgSlug,
    staleTime: 60_000,
  })
}

// FORK CHANGE (SEO): `initialData` lets a server component hand its already
// fetched course down, so the activity body is present in the delivered HTML
// instead of being replaced by a skeleton until a client fetch resolves.
export function useCourseMeta(courseUuid: string, initialData?: any) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const identity = session?.status === 'authenticated'
    ? String(session?.data?.user?.user_uuid ?? session?.data?.user?.id ?? 'authenticated')
    : 'anonymous'

  return useQuery({
    queryKey: queryKeys.courses.meta(courseUuid, identity),
    queryFn: () => getCourseMetadata(courseUuid, {}, accessToken, { slim: true }),
    enabled: !!courseUuid,
    staleTime: 60_000,
    initialData: initialData ?? undefined,
    // Mark the server payload as already stale so the mount refetch still runs.
    // Without this the seed counts as fresh for the whole staleTime, and a member
    // whose access-token cookie expired (getServerSession reports `unresolved`,
    // so SSR fetched anonymously) would keep the anonymous view for a full minute.
    initialDataUpdatedAt: initialData ? 0 : undefined,
  })
}

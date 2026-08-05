'use client'

import { useQuery } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { queryKeys } from '@lib/query/keys'
import { getActivityWithAuthHeader } from '@services/courses/activities'

// FORK CHANGE (SEO): `initialData` lets `page.tsx` hand down the activity it
// already fetched server-side, so PUBLIC activity content reaches the raw HTML.
// This does NOT widen access: the server fetch carries the visitor's own token
// (none for a crawler) and the API scrubs anything they cannot read, so a locked
// activity still arrives as `content = {}` / `is_locked = true`.
export function useActivity(activityUuid: string, initialData?: any) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery({
    queryKey: queryKeys.activity.detail(activityUuid),
    queryFn: () => getActivityWithAuthHeader(activityUuid, {}, accessToken),
    enabled: !!activityUuid,
    staleTime: 60_000,
    initialData: initialData ?? undefined,
  })
}

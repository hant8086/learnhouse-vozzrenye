'use client'

import { useQuery } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { queryKeys } from '@lib/query/keys'
import {
  getArticleWithAuthHeader,
  getArticlesWithAuthHeader,
} from '@services/articles/articles'

export function useArticle(articleUuid: string, initialData?: any) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery({
    queryKey: queryKeys.article.detail(articleUuid),
    queryFn: () => getArticleWithAuthHeader(articleUuid, {}, accessToken),
    enabled: !!articleUuid,
    staleTime: 60_000,
    initialData: initialData ?? undefined,
    // Critical: without this the seed is treated as fresh for the whole staleTime
    // and the mount refetch is skipped. A member whose access-token cookie expired
    // renders server-side as anonymous, so a restricted article comes back
    // `is_locked: true` — and they would then be shown the "ask a course admin to
    // add you" screen despite having access. Forcing a refetch with the rehydrated
    // token corrects it immediately.
    initialDataUpdatedAt: initialData ? 0 : undefined,
  })
}

export function useArticles(orgId: number, initialData?: any) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery({
    queryKey: queryKeys.article.list(orgId),
    queryFn: () => getArticlesWithAuthHeader(orgId, {}, accessToken),
    enabled: !!orgId,
    staleTime: 60_000,
    initialData: initialData ?? undefined,
    // Same reasoning as `useArticle`: a seeded list must be refetched on mount so
    // a rehydrated token corrects any locked/unlocked state the server fetch
    // computed without the visitor's session.
    initialDataUpdatedAt: initialData ? 0 : undefined,
  })
}
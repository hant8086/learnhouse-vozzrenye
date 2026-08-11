'use client'

import { useQuery } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { queryKeys } from '@lib/query/keys'
import {
  getArticleWithAuthHeader,
  getArticlesWithAuthHeader,
} from '@services/articles/articles'

/**
 * Resolve an article by either its "article_<uuid>" id or an org-scoped slug —
 * the same branching `fetchArticle` in `page.tsx` does server-side. Without
 * this, a slug like "новая-статья" was fetched as a raw path segment, which
 * hits the API's `/articles/{article_uuid}` catch-all instead of
 * `/articles/slug/{org_id}/{slug}`. That route 400s for anything that is not
 * an "article_" id ("org_id is required to resolve an article by slug"), and
 * `getArticleWithAuthHeader` returns the error body as-is (`{detail: "..."}`)
 * without checking `response.ok`. The mount refetch below then overwrote the
 * correct SSR-seeded article with that error object, and `!article.published`
 * (undefined on the error object) evaluated true — showing the access gate on
 * a fully public, published article.
 */
function resolveArticlePath(articleUuid: string, orgId?: number): string {
  if (articleUuid.startsWith('article_')) return articleUuid
  return orgId ? `slug/${orgId}/${articleUuid}` : articleUuid
}

export function useArticle(articleUuid: string, orgId?: number, initialData?: any) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const isUuidLookup = articleUuid?.startsWith('article_')

  return useQuery({
    queryKey: queryKeys.article.detail(articleUuid),
    queryFn: () =>
      getArticleWithAuthHeader(resolveArticlePath(articleUuid, orgId), {}, accessToken),
    // A slug lookup needs orgId to build the right path; without it, wait
    // rather than repeat the bug above with an unresolvable request.
    enabled: !!articleUuid && (isUuidLookup || !!orgId),
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

export function useArticles(
  orgId: number,
  initialData?: any,
  /** Dashboard reads ask for drafts; the public catalog must not, or an admin's
   *  draft rows would land in the cache entry the catalog reads. Hence the
   *  separate query key. */
  includeUnpublished = false
) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery({
    queryKey: includeUnpublished
      ? queryKeys.article.listAll(orgId)
      : queryKeys.article.list(orgId),
    queryFn: () =>
      getArticlesWithAuthHeader(orgId, {}, accessToken, includeUnpublished),
    enabled: !!orgId,
    staleTime: 60_000,
    initialData: initialData ?? undefined,
    // Same reasoning as `useArticle`: a seeded list must be refetched on mount so
    // a rehydrated token corrects any locked/unlocked state the server fetch
    // computed without the visitor's session.
    initialDataUpdatedAt: initialData ? 0 : undefined,
  })
}
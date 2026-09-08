/** Pure course CTA policy shared by desktop and mobile course overviews. */

export type PublicOffer = {
  offer_uuid?: string | null
  offer_id?: number | string | null
  offer_name?: string
  description?: string
  offer_type?: 'subscription' | 'one_time' | string
  price_type?: string
  amount?: number
  currency?: string
  benefits?: string
  is_public?: boolean
  public?: boolean
  is_active?: boolean
  archived?: boolean
  status?: string
  [key: string]: unknown
}

export type CourseStartAction =
  | { kind: 'login'; returnPath: string }
  | { kind: 'offer'; offer: PublicOffer }
  | { kind: 'unavailable' }
  | { kind: 'continue' }
  | { kind: 'start' }

/**
 * Pick one stable public offer.  The endpoint normally returns only public
 * offers, but keep this defensive filter here because the course page is a
 * public surface and must never link to a private/archived offer.
 */
export function selectFirstPublicOffer(offers: unknown): PublicOffer | null {
  if (!Array.isArray(offers)) return null

  const candidates = offers.filter((value): value is PublicOffer => {
    if (!value || typeof value !== 'object') return false
    const offer = value as PublicOffer
    if (!offer.offer_uuid) return false
    if (offer.is_public === false || offer.public === false) return false
    if (offer.is_active === false || offer.archived === true) return false
    if (typeof offer.status === 'string' && offer.status.toLowerCase() === 'archived') return false
    return true
  })

  candidates.sort((left, right) => {
    const uuidResult = String(left.offer_uuid).localeCompare(String(right.offer_uuid))
    if (uuidResult !== 0) return uuidResult
    return String(left.offer_id ?? '').localeCompare(String(right.offer_id ?? ''))
  })
  return candidates[0] ?? null
}

export function getCourseStartAction(input: {
  course: { is_paid?: boolean; has_access?: boolean }
  isAuthenticated: boolean
  isStarted: boolean
  returnPath: string
  offer?: PublicOffer | null
}): CourseStartAction {
  if (!input.isAuthenticated) return { kind: 'login', returnPath: input.returnPath }

  // Entitlement outranks stale TrailRun and the organization join prompt.  A
  // refunded/expired user's old run therefore cannot make the CTA continue.
  if (input.course.is_paid === true && input.course.has_access !== true) {
    return input.offer ? { kind: 'offer', offer: input.offer } : { kind: 'unavailable' }
  }

  return input.isStarted ? { kind: 'continue' } : { kind: 'start' }
}

/** Return the next incomplete activity in the same order shown by the course. */
export function getCourseResumeActivity(course: {
  chapters?: Array<{ activities?: Array<{ activity_uuid?: string; id?: string | number }> }>
}, run?: { steps?: Array<{ activity_id?: string | number; complete?: boolean }> | null } | null): string | null {
  const activities = (course.chapters || []).flatMap((chapter) => chapter.activities || [])
  if (!activities.length) return null
  const completed = new Set(
    (run?.steps || [])
      .filter((step) => step.complete)
      .map((step) => String(step.activity_id).replace(/^activity_/, '')),
  )
  const next = activities.find((activity) => {
    const ids = [activity.activity_uuid, activity.id]
      .filter((id): id is string | number => id !== undefined && id !== null)
      .map((id) => String(id).replace(/^activity_/, ''))
    return ids.length > 0 && ids.every((id) => !completed.has(id))
  }) || activities[0]
  return next.activity_uuid?.replace(/^activity_/, '') || null
}

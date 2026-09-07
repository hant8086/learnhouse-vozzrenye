export type LandingCourseRef = string | { course_uuid?: string | null }

export type LandingSectionLike = {
  type?: string
  courses?: LandingCourseRef[]
  courseIds?: string[]
}

export function normalizeLandingCourseRef(ref: LandingCourseRef | null | undefined): string | null {
  const value = typeof ref === 'string' ? ref : ref?.course_uuid
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function getAudienceLandingSections<T extends LandingSectionLike>(sections: T[], isAuthenticated: boolean): T[] {
  return isAuthenticated ? sections.filter((section) => section.type === 'featured-courses') : sections
}

export function getFeaturedCourseRefs(section: LandingSectionLike): string[] {
  // An explicitly empty modern courseIds array should still fall back to the
  // legacy courses field while old landing documents are being migrated.
  const modernRefs = section.courseIds
  const refs = section.type === 'showcase' && modernRefs?.length
    ? modernRefs
    : section.courses
  const seen = new Set<string>()
  return (refs ?? []).map(normalizeLandingCourseRef).filter((id): id is string => {
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

export function orderPublishedFeaturedCourses<T extends { course_uuid?: string | null; published?: boolean }>(
  courses: T[],
  refs: string[],
): T[] {
  const byId = new Map(courses.filter((course) => course.published !== false).map((course) => [course.course_uuid, course]))
  const seen = new Set<string>()
  return refs.map((id) => {
    if (seen.has(id)) return undefined
    seen.add(id)
    return byId.get(id)
  }).filter((course): course is T => Boolean(course))
}

export function getPublishedCatalogTail<T extends { course_uuid?: string | null; published?: boolean }>(courses: T[], usedIds: Set<string>): T[] {
  return courses.filter((course) => course.published !== false && typeof course.course_uuid === 'string' && !usedIds.has(course.course_uuid))
}

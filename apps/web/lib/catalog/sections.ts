export type CatalogSection = {
  key: string
  title: string
  order: number
}

export type CatalogCourse = {
  course_uuid: string
  extra_metadata?: Record<string, unknown> | null
}

export type CatalogSectionGroup<T extends CatalogCourse = CatalogCourse> = {
  section: CatalogSection | null
  courses: T[]
}

const OTHER_SECTION_KEY = '__other__'

export function readCatalogSections(config: unknown): CatalogSection[] {
  if (!config || typeof config !== 'object') return []
  const root = config as Record<string, unknown>
  const customization = root.customization
  const v2 = customization && typeof customization === 'object'
    ? (customization as Record<string, unknown>).course_catalog
    : undefined
  const raw = v2 ?? root.course_catalog
  if (!raw || typeof raw !== 'object') return []
  const sections = (raw as Record<string, unknown>).sections
  if (!Array.isArray(sections)) return []

  const seen = new Set<string>()
  return sections.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const key = typeof row.key === 'string' ? row.key.trim().toLowerCase() : ''
    const title = typeof row.title === 'string' ? row.title.trim() : ''
    if (!key || !title || seen.has(key)) return []
    seen.add(key)
    return [{
      key,
      title,
      order: typeof row.order === 'number' && Number.isFinite(row.order) ? row.order : 0,
    }]
  }).sort((a, b) => a.order - b.order || a.key.localeCompare(b.key))
}

export function getCatalogSectionKey(course: CatalogCourse): string | null {
  const value = course.extra_metadata?.catalog_section_key
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null
}

/** Group an already-filtered catalog without duplicating a course across sections. */
export function groupCatalogCourses<T extends CatalogCourse>(
  courses: T[],
  config: unknown,
): CatalogSectionGroup<T>[] {
  const sections = readCatalogSections(config)
  const byKey = new Map(sections.map((section) => [section.key, section]))
  const grouped = new Map<string, T[]>()
  const seenCourses = new Set<string>()

  for (const course of courses) {
    if (seenCourses.has(course.course_uuid)) continue
    seenCourses.add(course.course_uuid)
    const key = getCatalogSectionKey(course)
    const target = key && byKey.has(key) ? key : OTHER_SECTION_KEY
    const existing = grouped.get(target) ?? []
    existing.push(course)
    grouped.set(target, existing)
  }

  const result: CatalogSectionGroup<T>[] = sections
    .filter((section) => grouped.has(section.key))
    .map((section) => ({ section, courses: grouped.get(section.key) ?? [] }))
  const otherCourses = grouped.get(OTHER_SECTION_KEY)
  if (otherCourses?.length) result.push({ section: null, courses: otherCourses })
  return result
}

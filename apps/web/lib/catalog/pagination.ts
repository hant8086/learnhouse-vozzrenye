export async function collectCoursePages<T>(
  fetchPage: (page: number, limit: number) => Promise<T[]>,
  pageSize: number = 100,
  maxPages: number = 1000,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new RangeError('pageSize must be a positive integer')
  }
  if (!Number.isInteger(maxPages) || maxPages < 1) {
    throw new RangeError('maxPages must be a positive integer')
  }

  const courses: T[] = []
  for (let page = 1; page <= maxPages; page += 1) {
    const rows = await fetchPage(page, pageSize)
    courses.push(...rows)
    if (rows.length < pageSize) return courses
  }
  throw new Error(`Course catalog exceeded the ${maxPages}-page safety limit`)
}

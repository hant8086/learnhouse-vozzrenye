export async function collectCoursePages<T>(
  fetchPage: (page: number, limit: number) => Promise<T[]>,
  pageSize: number = 100,
): Promise<T[]> {
  const courses: T[] = []
  let page = 1
  while (true) {
    const rows = await fetchPage(page, pageSize)
    courses.push(...rows)
    if (rows.length < pageSize) return courses
    page += 1
  }
}

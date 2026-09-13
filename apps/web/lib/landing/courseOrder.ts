/** Move a selected module by one position without mutating saved configuration. */
export function moveLandingCourse(ids: string[], id: string, direction: -1 | 1): string[] {
  const index = ids.indexOf(id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= ids.length) return ids
  const reordered = [...ids]
  ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
  return reordered
}

import { expect, test } from 'bun:test'
import { moveLandingCourse } from '../lib/landing/courseOrder.ts'
import { orderPublishedFeaturedCourses, getFeaturedCourseRefs } from '../lib/landing/audienceProjection.ts'

test('selected order survives serialization and controls the public landing', () => {
  const original = ['c', 'a', 'b']
  const courses = [{ course_uuid: 'a' }, { course_uuid: 'b' }, { course_uuid: 'c' }]
  const reordered = moveLandingCourse(original, 'b', -1)
  const saved = JSON.parse(JSON.stringify({ courses: reordered }))
  expect(original).toEqual(['c', 'a', 'b'])
  expect(orderPublishedFeaturedCourses(courses, saved.courses).map(course => course.course_uuid)).toEqual(['c', 'b', 'a'])
  expect(moveLandingCourse(reordered, 'b', 1)).toEqual(original)
})

test('boundary moves and unavailable IDs do not change the selection', () => {
  expect(moveLandingCourse(['a', 'b'], 'a', -1)).toEqual(['a', 'b'])
  expect(moveLandingCourse(['a', 'b'], 'b', 1)).toEqual(['a', 'b'])
  expect(moveLandingCourse(['a'], 'missing', -1)).toEqual(['a'])
  expect(moveLandingCourse([], 'a', 1)).toEqual([])
})


test('legacy object selections can be reordered and saved as canonical IDs', () => {
  const selected = getFeaturedCourseRefs({ type: 'featured-courses', courses: [{ course_uuid: 'a' }, 'b', 'a'] })
  expect(moveLandingCourse(selected, 'b', -1)).toEqual(['b', 'a'])
})

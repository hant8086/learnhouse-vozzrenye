import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  getAudienceLandingSections,
  getFeaturedCourseRefs,
  getPublishedCatalogTail,
  orderPublishedFeaturedCourses,
} from '../lib/landing/audienceProjection.ts'

const courses = [
  { course_uuid: 'course_b', published: true },
  { course_uuid: 'course_a', published: true },
  { course_uuid: 'course_d', published: false },
  { course_uuid: 'course_c', published: true },
]

describe('landing audience projection', () => {
  it('keeps the guest custom landing and limits authenticated home to featured', () => {
    const sections = [{ type: 'hero' }, { type: 'featured-courses' }, { type: 'showcase' }]
    assert.deepEqual(getAudienceLandingSections(sections, false), sections)
    assert.deepEqual(getAudienceLandingSections(sections, true), [{ type: 'featured-courses' }])
  })

  it('orders only published featured courses by settings, not API order', () => {
    assert.deepEqual(
      orderPublishedFeaturedCourses(courses, ['course_c', 'course_d', 'course_a', 'course_c']),
      [courses[3], courses[1]],
    )
  })

  it('deduplicates refs and supports empty modern showcase refs via legacy refs', () => {
    assert.deepEqual(
      getFeaturedCourseRefs({ type: 'showcase', courseIds: [], courses: ['course_b', 'course_b', 'course_a'] }),
      ['course_b', 'course_a'],
    )
    assert.deepEqual(getPublishedCatalogTail(courses, new Set(['course_a'])), [courses[0], courses[3]])
  })
})

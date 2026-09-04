import { describe, it } from 'node:test'
import assert from 'node:assert/strict';

import { normalizeShowcase } from '../components/Landings/Showcase/model.ts'

describe('normalizeShowcase', () => {
  it('normalizes legacy course objects and trims editable fields', () => {
    const result = normalizeShowcase({
      greetingHeading: '  Learn Rust  ',
      greetingDescription: '   ',
      stats: [{ value: ' 12 ', label: ' Courses ' }, { value: '', label: '' }],
      features: [{ icon: 'unknown', title: ' Practice ', description: '' }],
      steps: [{ title: ' Start ', number: '', description: ' Begin here ' }],
      offer: {
        heading: ' Offer ',
        highlights: [' Mentorship ', '', null],
        ctaLabel: ' Browse ',
        ctaHref: '',
      },
      courses: [{ course_uuid: 'course_1' }, 'course_2', { id: 'course_1' }, { id: '  '}],
      coursesTitle: ' Catalog ',
    })

    assert.deepStrictEqual(result, {
      type: 'showcase',
      greetingEyebrow: '',
      greetingHeading: 'Learn Rust',
      greetingDescription: '',
      stats: [{ value: '12', label: 'Courses' }],
      features: [{ icon: 'layers', title: 'Practice', description: '' }],
      steps: [{ number: '1', title: 'Start', description: 'Begin here' }],
      offer: {
        eyebrow: '',
        heading: 'Offer',
        description: '',
        highlights: ['Mentorship'],
        ctaLabel: 'Browse',
        ctaHref: '/courses',
      },
      courseIds: ['course_1', 'course_2'],
      coursesTitle: 'Catalog',
      coursesDescription: '',
    })
  })

  it('returns a stable shape for malformed config data', () => {
    const result = normalizeShowcase(undefined)

    assert.equal(result.type, 'showcase')
    assert.deepStrictEqual(result.stats, [])
    assert.deepStrictEqual(result.features, [])
    assert.deepStrictEqual(result.steps, [])
    assert.equal(result.offer.ctaHref, '/courses')
    assert.deepStrictEqual(result.courseIds, [])
  })

  it('accepts persisted UUID strings and removes duplicate course refs', () => {
    const result = normalizeShowcase({ courseIds: ['course_1', ' course_1 ', { course_uuid: 'course_2' }] })

    assert.deepStrictEqual(result.courseIds, ['course_1', 'course_2'])
  })
})

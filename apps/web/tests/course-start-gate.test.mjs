import { describe, expect, test } from 'bun:test'

// Keep the policy module dependency-free so this focused test can run in the
// repository's lightweight Bun test environment.
import { getCourseStartAction, selectFirstPublicOffer } from '../lib/courses/startGate.ts'

describe('course start gate', () => {
  const base = {
    course: { is_paid: true, has_access: false },
    isAuthenticated: true,
    isStarted: true,
    returnPath: '/course/course-a',
  }

  test('login preserves the course return path for guests', () => {
    expect(getCourseStartAction({ ...base, isAuthenticated: false })).toEqual({
      kind: 'login',
      returnPath: '/course/course-a',
    })
  })

  test('paid access denial wins over org membership and stale trail state', () => {
    expect(getCourseStartAction({ ...base, offer: { offer_uuid: 'offer_public' } })).toEqual({
      kind: 'offer',
      offer: { offer_uuid: 'offer_public' },
    })
  })

  test('paid access denial without a public offer is an explicit unavailable state', () => {
    expect(getCourseStartAction({ ...base, offer: null })).toEqual({ kind: 'unavailable' })
  })

  test('entitled paid users continue normally', () => {
    expect(getCourseStartAction({ ...base, course: { is_paid: true, has_access: true } })).toEqual({ kind: 'leave' })
  })

  test('free authenticated users start normally regardless of org membership', () => {
    expect(getCourseStartAction({ ...base, course: { is_paid: false }, isStarted: false })).toEqual({ kind: 'start' })
  })

  test('selects one stable public offer by UUID and ignores private/archived offers', () => {
    const selected = selectFirstPublicOffer([
      { offer_uuid: 'offer-z', is_public: true },
      { offer_uuid: 'offer-private', is_public: false },
      { offer_uuid: 'offer-a', is_active: true },
      { offer_uuid: 'offer-archived', status: 'archived' },
    ])
    expect(selected?.offer_uuid).toBe('offer-a')
  })
})

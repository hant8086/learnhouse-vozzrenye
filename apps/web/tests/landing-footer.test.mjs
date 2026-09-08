import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getLandingFooterLinks, normalizeLandingUrl, normalizeLandingFooterLinks } from '../lib/landing/footer.ts'

describe('landing footer links', () => {
  it('keeps empty destinations disabled and preserves the three configured slots', () => {
    assert.deepEqual(getLandingFooterLinks({}), [
      { label: 'Миссия', href: null },
      { label: 'Сообщество', href: null },
      { label: 'Технология', href: null },
    ])
    assert.deepEqual(normalizeLandingFooterLinks([
      { label: ' Миссия проекта ', href: '/mission' },
      { label: '', href: 'javascript:alert(1)' },
    ]), [
      { label: 'Миссия проекта', href: '/mission' },
      { label: 'Сообщество', href: null },
      { label: 'Технология', href: null },
    ])
  })

  it('accepts relative and HTTP(S) URLs but rejects unsafe navigation values', () => {
    assert.equal(normalizeLandingUrl('/community?tab=about'), '/community?tab=about')
    assert.equal(normalizeLandingUrl('https://example.com/about'), 'https://example.com/about')
    assert.equal(normalizeLandingUrl('//example.com/about'), null)
    assert.equal(normalizeLandingUrl('/\\\\example.com'), null)
    assert.equal(normalizeLandingUrl('javascript:alert(1)'), null)
  })
})

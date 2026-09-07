import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  getTagColorStyle,
  mergeTagColorMetadata,
  normalizeTagColors,
  parseCourseTags,
} from '../lib/courses/tagColors.ts'

describe('course tag colors', () => {
  it('accepts only six-digit hex values and canonicalizes them', () => {
    assert.deepEqual(normalizeTagColors({ Topic: '#aBc123', bad: 'red', short: '#fff', css: 'url(x)' }), { Topic: '#ABC123' })
  })

  it('deduplicates tags case-insensitively while preserving display text', () => {
    assert.deepEqual(parseCourseTags(' Design, design ; UX |  ux '), ['Design', 'UX'])
  })

  it('preserves unrelated metadata and protects malformed metadata', () => {
    assert.deepEqual(
      mergeTagColorMetadata({ catalog_section_key: 'featured', nested: { keep: true } }, { topic: '#123456' }),
      { catalog_section_key: 'featured', nested: { keep: true }, tag_colors: { topic: '#123456' } },
    )
    assert.deepEqual(mergeTagColorMetadata('not-an-object', {}), {})
  })

  it('returns readable foreground and a neutral fallback for unknown colors', () => {
    assert.equal(getTagColorStyle('topic', { Topic: '#FFFFFF' }).color, '#1F2937')
    assert.equal(getTagColorStyle('missing', {}).backgroundColor, '#F3F4F6')
  })
})

import { describe, expect, test } from 'bun:test'
import { sanitizeMediaUrl } from '../components/Objects/SafeImage'

describe('saved media URLs', () => {
  test('accepts same-origin saved thumbnails and empty preview assets', () => {
    for (const url of ['/content/orgs/org_1/courses/course_1/thumbnails/cover.jpg', '/empty_thumbnail.png', 'https://media.example/cover.jpg', 'blob:https://example.org/123']) {
      expect(sanitizeMediaUrl(url)).toBe(url)
    }
  })
  test('rejects executable and ambiguous URLs', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,<script>', '//external.example/image', '/\\external.example/image', '/\n/external.example/image', '', 'relative.jpg']) {
      expect(sanitizeMediaUrl(url)).toBeUndefined()
    }
  })
})

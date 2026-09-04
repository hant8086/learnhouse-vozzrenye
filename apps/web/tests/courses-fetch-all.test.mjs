import assert from 'node:assert/strict'
import { test } from 'node:test'
import { collectCoursePages } from '../lib/catalog/pagination.ts'

test('collectCoursePages fetches the page after a full 100-row page', async () => {
  const requested = []
  const rows = await collectCoursePages(async (page, limit) => {
    requested.push([page, limit])
    if (page === 1) return Array.from({ length: 100 }, (_, i) => ({ id: i }))
    return [{ id: 100 }]
  })
  assert.equal(rows.length, 101)
  assert.deepEqual(requested, [[1, 100], [2, 100]])
})

test('collectCoursePages checks the empty page after an exact multiple', async () => {
  const requested = []
  const rows = await collectCoursePages(async (page, limit) => {
    requested.push([page, limit])
    return page <= 2 ? Array.from({ length: 100 }, (_, i) => ({ id: (page - 1) * 100 + i })) : []
  })
  assert.equal(rows.length, 200)
  assert.deepEqual(requested, [[1, 100], [2, 100], [3, 100]])
})

test('collectCoursePages terminates with an error on an endless full-page source', async () => {
  await assert.rejects(
    collectCoursePages(async () => Array.from({ length: 2 }, () => ({ id: 1 })), 2, 3),
    /safety limit/,
  )
})

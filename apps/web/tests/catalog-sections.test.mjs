import assert from 'node:assert/strict'
import { test } from 'node:test'
import { groupCatalogCourses, readCatalogSections } from '../lib/catalog/sections.ts'

const course = (course_uuid, catalog_section_key) => ({
  course_uuid,
  extra_metadata: catalog_section_key === undefined ? {} : { catalog_section_key },
})

test('reads v2 sections in deterministic order and ignores duplicate keys', () => {
  const sections = readCatalogSections({
    customization: {
      course_catalog: {
        sections: [
          { key: 'z', title: 'Zed', order: 20 },
          { key: 'a', title: 'Alpha', order: 10 },
          { key: 'a', title: 'Duplicate', order: 1 },
        ],
      },
    },
  })
  assert.deepEqual(sections.map(({ key }) => key), ['a', 'z'])
})

test('groups filtered courses once and sends unknown/unassigned courses to Other', () => {
  const groups = groupCatalogCourses(
    [course('c1', 'z'), course('c2', 'deleted'), course('c3'), course('c1', 'z')],
    { course_catalog: { sections: [{ key: 'z', title: 'Zed', order: 1 }] } },
  )
  assert.deepEqual(groups.map(({ section, courses }) => [section?.key ?? 'other', courses.map(({ course_uuid }) => course_uuid)]), [
    ['z', ['c1']],
    ['other', ['c2', 'c3']],
  ])
})

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { queryKeys } from '../lib/query/keys.ts'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('learner surface contracts', () => {
  it('keeps the start/leave CTA free of account avatars', () => {
    const source = read('../components/Objects/Courses/CourseActions/CoursesActions.tsx')
    assert.doesNotMatch(source, /UserAvatar/)
    assert.match(source, /courses\.start_course/)
  })

  it('uses 3:2 contained media for learner course cards and overview', () => {
    const card = read('../components/Objects/Thumbnails/CourseThumbnail.tsx')
    const landingCard = read('../components/Objects/Thumbnails/CourseThumbnailLanding.tsx')
    const overview = read('../app/orgs/[orgslug]/(withmenu)/course/[courseuuid]/course.tsx')
    for (const source of [card, landingCard, overview]) {
      assert.match(source, /aspect-\[3\/2\]/)
      assert.match(source, /object-contain/)
    }
    assert.doesNotMatch(card, /en-US/)
    assert.doesNotMatch(landingCard, /en-US/)
  })

  it('does not expose a learner language selector and hides auth branding on mobile', () => {
    assert.doesNotMatch(read('../components/Auth/AuthLayout.tsx'), /LanguageSwitcher|AuthMobileHeader/)
    const header = read('../components/Security/HeaderProfileBox.tsx')
    assert.doesNotMatch(header, /LanguageSwitcher|AVAILABLE_LANGUAGES|changeLanguage|common\.language/)
    assert.match(read('../components/Auth/AuthLayout.tsx'), /hidden shrink-0 lg:block/)
  })

  it('separates public and per-user course projections in the query cache', () => {
    assert.notDeepEqual(queryKeys.courses.list('org', 'anonymous'), queryKeys.courses.list('org', 'user-1'))
    assert.notDeepEqual(queryKeys.courses.meta('course-1', 'anonymous'), queryKeys.courses.meta('course-1', 'user-1'))
    const overview = read('../app/orgs/[orgslug]/(withmenu)/course/[courseuuid]/course.tsx')
    assert.match(overview, /meta\(courseuuid, sessionIdentity\)/)
    assert.match(overview, /initialDataUpdatedAt: initialCourse \? 0 : undefined/)
  })
})

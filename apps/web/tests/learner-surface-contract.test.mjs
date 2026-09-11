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

  it('uses 16:9 contained media for learner course cards and overview', () => {
    const card = read('../components/Objects/Thumbnails/CourseThumbnail.tsx')
    const landingCard = read('../components/Objects/Thumbnails/CourseThumbnailLanding.tsx')
    const overview = read('../app/orgs/[orgslug]/(withmenu)/course/[courseuuid]/course.tsx')
    for (const source of [card, landingCard, overview]) {
      assert.match(source, /aspect-\[16\/9\]/)
      assert.match(source, /object-contain/)
    }
    assert.doesNotMatch(card, /en-US/)
    assert.doesNotMatch(landingCard, /en-US/)
  })

  it('does not expose a learner language selector and centers auth branding on mobile', () => {
    const authLayout = read('../components/Auth/AuthLayout.tsx')
    assert.doesNotMatch(authLayout, /LanguageSwitcher/)
    assert.match(authLayout, /AuthMobileHeader/)
    assert.match(authLayout, /lg:hidden/)
    assert.match(authLayout, /AuthFooter className="shrink-0"/)
    const authFooter = read('../components/Footers/LegalFooters.tsx')
    assert.match(authFooter, /Условиями использования/)
    assert.match(authFooter, /Политикой конфиденциальности/)
    const header = read('../components/Security/HeaderProfileBox.tsx')
    assert.doesNotMatch(header, /LanguageSwitcher|AVAILABLE_LANGUAGES|changeLanguage|common\.language/)
  })

  it('separates public and per-user course projections in the query cache', () => {
    assert.notDeepEqual(queryKeys.courses.list('org', 'anonymous'), queryKeys.courses.list('org', 'user-1'))
    assert.notDeepEqual(queryKeys.courses.meta('course-1', 'anonymous'), queryKeys.courses.meta('course-1', 'user-1'))
    const overview = read('../app/orgs/[orgslug]/(withmenu)/course/[courseuuid]/course.tsx')
    assert.match(overview, /meta\(courseuuid, sessionIdentity\)/)
    assert.match(overview, /initialDataUpdatedAt: initialCourse \? 0 : undefined/)
  })

  it('keeps the course overview metadata and reader helper popovers responsive', () => {
    const overview = read('../app/orgs/[orgslug]/(withmenu)/course/[courseuuid]/course.tsx')
    assert.doesNotMatch(overview, /КУРС \/ ОБЗОР/)
    assert.match(overview, /parseCourseTags/)

    const tooltip = read('../components/Objects/StyledElements/Tooltip/Tooltip.tsx')
    assert.match(tooltip, /collisionPadding=\{12\}/)
    assert.match(tooltip, /max-w-\[calc\(100vw-1\.5rem\)\]/)
  })

  it('keeps leave as the final course action without a pulse animation', () => {
    const desktop = read('../components/Objects/Courses/CourseActions/CoursesActions.tsx')
    const mobile = read('../components/Objects/Courses/CourseActions/CourseActionsMobile.tsx')
    assert.ok(desktop.indexOf('{renderContributorButton()}') < desktop.indexOf('onClick={handleLeaveCourse}'))
    assert.ok(mobile.indexOf('onClick={handleCourseAction}') < mobile.indexOf('onClick={handleLeaveCourse}'))
    for (const source of [desktop, mobile]) {
      const leaveButton = source.slice(source.indexOf('onClick={handleLeaveCourse}'), source.indexOf('onClick={handleLeaveCourse}') + 420)
      assert.doesNotMatch(leaveButton, /animate-(pulse|ping)|animation-/)
    }
  })

  it('keeps token-exchange auth states in Russian', () => {
    const tokenExchange = read('../app/auth/token-exchange/page.tsx')
    assert.match(tokenExchange, /Не удалось выполнить вход/)
    assert.match(tokenExchange, /Вернуться ко входу/)
    assert.match(tokenExchange, /Выполняем вход/)
    assert.match(tokenExchange, /Пожалуйста, подождите/)
    assert.doesNotMatch(tokenExchange, /Authentication Failed|Go to Login|Signing you in|Please wait while/)
  })
})

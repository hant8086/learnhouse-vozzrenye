import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

import { normalizeShowcase } from '../components/Landings/Showcase/model.ts'

const rendererEntry = process.env.SHOWCASE_RENDERER_ENTRY
const rendererAvailable = Boolean(rendererEntry)
let React
let renderToStaticMarkup
let LandingShowcase

if (rendererAvailable) {
  React = (await import('react')).default
  ;({ renderToStaticMarkup } = await import('react-dom/server'))
  ;({ default: LandingShowcase } = await import(pathToFileURL(rendererEntry)))
}

const section = {
  type: 'showcase',
  greetingEyebrow: 'PLATFORM',
  greetingHeading: 'Learn deliberately',
  greetingDescription: 'A focused path.',
  stats: Array.from({ length: 6 }, (_, index) => ({ value: `${index}`, label: `Stat ${index}` })),
  features: [
    { icon: 'route', title: 'Path', description: 'Know the next step' },
    { icon: 'practice', title: 'Practice', description: 'Apply each idea' },
  ],
  steps: Array.from({ length: 5 }, (_, index) => ({
    number: `0${index + 1}`,
    title: `Step ${index + 1}`,
    description: `Description ${index + 1}`,
  })),
  offer: {
    eyebrow: 'OFFER',
    heading: 'Choose a track',
    description: 'Structured learning',
    highlights: ['Mentorship'],
    ctaLabel: 'Browse',
    ctaHref: '/courses',
  },
  courseIds: ['course_1'],
  coursesTitle: 'Selected courses',
  coursesDescription: 'A starting set',
}

describe('LandingShowcase public contract', () => {
  if (!rendererAvailable) {
    it('requires a configured TSX renderer entry for integration coverage', { skip: 'set SHOWCASE_RENDERER_ENTRY in a dependency-enabled test environment' }, () => {})
    return
  }

  const html = renderToStaticMarkup(React.createElement(LandingShowcase, {
    section,
    orgslug: 'vozzrenye',
  }))

  it('renders every guided block', () => {
    for (const text of [
      'Learn deliberately',
      'Path',
      'How it works',
      'Selected courses',
      'Choose a track',
      'Browse',
    ]) {
      assert.ok(html.includes(text), `expected rendered output to include ${text}`)
    }
  })

  it('caps visible collections to the designed layout', () => {
    assert.equal(normalizeShowcase(section).stats.length, 6)
    assert.ok((html.match(/Stat \d/g) ?? []).every((match) => Number(match.slice(5)) < 4))
    assert.equal((html.match(/Step 4/g) ?? []).length, 0)
  })

  it('keeps relative CTA links inside the organization namespace', () => {
    assert.ok(html.includes('href="/orgs/vozzrenye/courses"'))
  })

  it('does not interpret persisted content as markup', () => {
    const hostile = renderToStaticMarkup(React.createElement(LandingShowcase, {
      section: {
        ...section,
        greetingHeading: '<img src=x onerror=alert(1)>',
      },
      orgslug: 'vozzrenye',
    }))

    assert.ok(hostile.includes('&lt;img'))
    assert.ok(!hostile.includes('<img src=x'))
  })
})

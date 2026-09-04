export interface NormalizedShowcaseStat {
  value: string
  label: string
}

export interface NormalizedShowcaseFeature {
  icon: 'layers' | 'route' | 'practice' | 'progress'
  title: string
  description: string
}

export interface NormalizedShowcaseStep {
  number: string
  title: string
  description: string
}

export interface NormalizedShowcaseOffer {
  eyebrow: string
  heading: string
  description: string
  highlights: Array<string>
  ctaLabel: string
  ctaHref: string
}

export interface NormalizedLandingShowcase {
  type: 'showcase'
  greetingEyebrow: string
  greetingHeading: string
  greetingDescription: string
  stats: Array<NormalizedShowcaseStat>
  features: Array<NormalizedShowcaseFeature>
  steps: Array<NormalizedShowcaseStep>
  offer: NormalizedShowcaseOffer
  courseIds: Array<string>
  coursesTitle: string
  coursesDescription: string
}

const asRecord = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' ? value as Record<string, any> : {}

const asText = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value.trim() || fallback : fallback

const asList = (value: unknown): Array<Record<string, any>> =>
  Array.isArray(value) ? value.map(asRecord) : []

const asCourseIds = (value: unknown): Array<string> => {
  if (!Array.isArray(value)) return []

  const courseIds = value.flatMap((item) => {
    const courseId = typeof item === 'string'
      ? item.trim()
      : asText(asRecord(item).course_uuid ?? asRecord(item).courseUuid ?? asRecord(item).id)
    return courseId ? [courseId] : []
  })

  return [...new Set(courseIds)]
}

export function normalizeShowcase(section: unknown): NormalizedLandingShowcase {
  const source = asRecord(section)
  const offer = asRecord(source.offer)

  return {
    type: 'showcase',
    greetingEyebrow: asText(source.greetingEyebrow),
    greetingHeading: asText(source.greetingHeading),
    greetingDescription: asText(source.greetingDescription),
    stats: asList(source.stats).map((stat) => ({
      value: asText(stat.value),
      label: asText(stat.label),
    })).filter((stat) => stat.value || stat.label),
    features: asList(source.features).map((feature) => ({
      icon: ['layers', 'route', 'practice', 'progress'].includes(feature.icon) ? feature.icon : 'layers',
      title: asText(feature.title),
      description: asText(feature.description),
    })).filter((feature) => feature.title || feature.description),
    steps: asList(source.steps).map((step, index) => ({
      number: asText(step.number, String(index + 1)),
      title: asText(step.title),
      description: asText(step.description),
    })),
    offer: {
      eyebrow: asText(offer.eyebrow),
      heading: asText(offer.heading),
      description: asText(offer.description),
      highlights: Array.isArray(offer.highlights)
        ? offer.highlights.map((highlight) => asText(highlight)).filter(Boolean)
        : [],
      ctaLabel: asText(offer.ctaLabel),
      ctaHref: asText(offer.ctaHref, '/courses'),
    },
    courseIds: asCourseIds(source.courseIds ?? source.courses),
    coursesTitle: asText(source.coursesTitle),
    coursesDescription: asText(source.coursesDescription),
  }
}

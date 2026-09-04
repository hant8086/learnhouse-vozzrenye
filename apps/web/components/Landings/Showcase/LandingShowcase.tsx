'use client'

import React from 'react'
import { Layers, Route, Repeat, TrendingUp } from 'lucide-react'
import { RevealGroup, RevealItem } from '@components/Objects/Motion/Reveal'
import CourseThumbnailLanding from '@components/Objects/Thumbnails/CourseThumbnailLanding'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { getOrgCourses } from '@services/courses/courses'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { normalizeShowcase } from './model'

interface LandingShowcaseProps {
  section: unknown
  orgslug: string
}

const FEATURE_ICONS = {
  layers: Layers,
  route: Route,
  practice: Repeat,
  progress: TrendingUp,
} as const

function ShowcaseHeading({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <header className="max-w-3xl">
      {eyebrow && <p className="mono-label">{eyebrow}</p>}
      <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">{title}</h2>
      <div className="mt-5 h-px w-16 bg-[var(--color-signal)]" />
    </header>
  )
}

function LandingShowcase({ section, orgslug }: LandingShowcaseProps) {
  const showcase = normalizeShowcase(section)
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token

  const { data: allCourses } = useQuery({
    queryKey: queryKeys.courses.list(orgslug),
    queryFn: () => getOrgCourses(orgslug, null, accessToken),
    enabled: showcase.courseIds.length > 0,
    staleTime: 60_000,
  })

  const selectedCourses = (allCourses ?? []).filter((course: any) =>
    showcase.courseIds.includes(course.course_uuid),
  )
  const isExternalHref = /^https?:\/\//i.test(showcase.offer.ctaHref)
  const isRelativeHref = /^\/(?!\/)/.test(showcase.offer.ctaHref)
  const offerHref = isExternalHref
    ? showcase.offer.ctaHref
    : getUriWithOrg(orgslug, isRelativeHref ? showcase.offer.ctaHref : '/courses')

  return (
    <section className="relative mx-auto w-full max-w-(--breakpoint-2xl) overflow-hidden px-4 py-10 sm:px-6 md:py-16 lg:px-16">
      <div aria-hidden className="pointer-events-none absolute -right-32 -top-40 h-[26rem] w-[26rem] rounded-full bg-[var(--color-signal)] opacity-[.07] blur-3xl" />

      <RevealGroup className="relative">
        <RevealItem>
          <div className="vz-frame bg-white p-7 sm:p-10 lg:p-14">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,.72fr)_minmax(0,.28fr)]">
              <div>
                <p className="mono-label">{showcase.greetingEyebrow}</p>
                <h1 className="mt-4 text-balance text-4xl font-black leading-[1.05] tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
                  {showcase.greetingHeading}
                </h1>
                <p className="mt-6 max-w-xl whitespace-pre-line text-lg leading-relaxed text-gray-600">
                  {showcase.greetingDescription}
                </p>
              </div>

              {showcase.stats.length > 0 && (
                <dl className="grid grid-cols-2 gap-px self-center overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-line)]">
                  {showcase.stats.slice(0, 4).map((stat) => (
                    <div key={`${stat.value}-${stat.label}`} className="bg-white p-5">
                      <dt className="mono-label">{stat.label}</dt>
                      <dd className="mt-2 text-2xl font-bold tracking-tight text-gray-900">{stat.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>
        </RevealItem>

        {showcase.features.length > 0 && (
          <RevealGroup className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {showcase.features.map((feature) => {
              const Icon = FEATURE_ICONS[feature.icon]

              return (
                <RevealItem key={feature.title}>
                  <article className="h-full border border-[var(--color-line)] border-t-[var(--color-signal)] bg-white p-6 transition-transform duration-200 hover:-translate-y-0.5">
                    <Icon size={24} className="text-[var(--color-signal-dark)]" />
                    <h3 className="mt-5 text-lg font-semibold tracking-tight text-gray-900">{feature.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-gray-600">{feature.description}</p>
                  </article>
                </RevealItem>
              )
            })}
          </RevealGroup>
        )}

        {showcase.steps.length > 0 && (
          <div className="mt-20">
            <ShowcaseHeading eyebrow="LEARNING PATH" title="How it works" />
            <ol className="mt-8 grid gap-8 md:grid-cols-3">
              {showcase.steps.slice(0, 3).map((step) => (
                <li key={step.number} className="border-l border-[var(--color-line-strong)] pl-6">
                  <span className="font-mono text-sm font-medium text-[var(--color-signal-dark)]">{step.number}</span>
                  <h3 className="mt-3 text-xl font-semibold tracking-tight text-gray-900">{step.title}</h3>
                  <p className="mt-3 leading-relaxed text-gray-600">{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {(showcase.coursesTitle || selectedCourses.length > 0) && (
          <div className="mt-20">
            <ShowcaseHeading eyebrow="SELECTED COURSES" title={showcase.coursesTitle} />
            {showcase.coursesDescription && (
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-gray-600">{showcase.coursesDescription}</p>
            )}

            <RevealGroup className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {selectedCourses.map((course: any) => (
                <RevealItem key={course.course_uuid} className="flex w-full justify-center">
                  <CourseThumbnailLanding course={course} orgslug={orgslug} />
                </RevealItem>
              ))}
            </RevealGroup>
          </div>
        )}

        {(showcase.offer.heading || showcase.offer.description) && (
          <RevealItem className="mt-20">
            <div className="relative overflow-hidden bg-[#111410] p-8 text-white sm:p-12">
              <div aria-hidden className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_75%_50%,rgba(238,162,47,.22),transparent_60%)] lg:block" />

              <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <div>
                  <p className="mono-label !text-white/55">{showcase.offer.eyebrow}</p>
                  <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{showcase.offer.heading}</h2>
                  <p className="mt-4 max-w-2xl text-white/70">{showcase.offer.description}</p>

                  {showcase.offer.highlights.length > 0 && (
                    <ul className="mt-7 flex flex-wrap gap-x-7 gap-y-3 text-sm text-white/80">
                      {showcase.offer.highlights.map((highlight) => (
                        <li key={highlight} className="flex items-center gap-3">
                          <span className="h-px w-6 bg-[var(--color-signal)]" />
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {showcase.offer.ctaLabel && (
                  <a
                    href={offerHref}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--color-signal)] px-6 font-semibold text-[#111410] transition hover:brightness-110"
                  >
                    {showcase.offer.ctaLabel}
                  </a>
                )}
              </div>
            </div>
          </RevealItem>
        )}
      </RevealGroup>
    </section>
  )
}

export default LandingShowcase

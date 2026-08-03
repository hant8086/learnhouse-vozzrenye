'use client'
import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { LAST_UPDATED } from './legalConfig'

/**
 * Renderer for the legal pages (/privacy, /terms).
 *
 * The documents are bilingual. Google's OAuth reviewers read English, while
 * the actual audience is Russian-speaking, and a policy nobody can read is
 * not a policy. The initial language follows the app's i18n locale (which
 * falls back to English), and a toggle lets either audience switch. The
 * chosen language is reflected in the `lang` attribute so screen readers and
 * translation tools treat the text correctly.
 *
 * Copy lives in the page modules, not here — this file only lays it out.
 */

export type LegalSection = {
  /** Stable anchor id, shared between languages so links survive a switch. */
  id: string
  heading: string
  /** Paragraphs and lists, in order. */
  body: Array<string | { list: string[] }>
}

export type LegalContent = {
  title: string
  /** One-line statement of what the document covers. */
  intro: string
  sections: LegalSection[]
}

export type LegalDocumentProps = {
  ru: LegalContent
  en: LegalContent
}

type Lang = 'ru' | 'en'

export default function LegalDocument({ ru, en }: LegalDocumentProps) {
  const { i18n } = useTranslation()
  const [lang, setLang] = React.useState<Lang>(() =>
    i18n?.language?.toLowerCase().startsWith('ru') ? 'ru' : 'en',
  )

  const doc = lang === 'ru' ? ru : en
  const updatedLabel = lang === 'ru' ? 'Обновлено' : 'Last updated'
  const backLabel = lang === 'ru' ? 'На платформу' : 'Back to the platform'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-3xl px-6 py-14 sm:py-20">
        <header className="mb-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/"
              className="vz-mono hover:text-amber-800 transition-colors"
            >
              ← {backLabel}
            </Link>
            <div className="flex items-center gap-1" role="group" aria-label="Language">
              {(['ru', 'en'] as Lang[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  aria-pressed={lang === code}
                  className={`vz-mono px-2.5 py-1 rounded-full transition-colors ${
                    lang === code
                      ? 'bg-gray-900 text-gray-50'
                      : 'text-gray-500 hover:text-amber-800'
                  }`}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <h1 className="mt-8 text-3xl sm:text-4xl font-semibold tracking-tight text-gray-900">
            {doc.title}
          </h1>
          <p className="vz-mono mt-3">
            {updatedLabel} · {LAST_UPDATED}
          </p>
          <hr className="vz-hairline vz-hairline-signal mt-6" />
          <p className="mt-6 text-gray-700 leading-relaxed">{doc.intro}</p>
        </header>

        <article lang={lang} className="space-y-10">
          {doc.sections.map((section, index) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="text-lg font-semibold text-gray-900 flex items-baseline gap-3">
                <span className="vz-mono">{String(index + 1).padStart(2, '0')}</span>
                {section.heading}
              </h2>
              <div className="mt-3 space-y-3">
                {section.body.map((block, i) =>
                  typeof block === 'string' ? (
                    <p key={i} className="text-gray-700 leading-relaxed">
                      {block}
                    </p>
                  ) : (
                    <ul key={i} className="space-y-2 pl-1">
                      {block.list.map((item, j) => (
                        <li key={j} className="flex gap-3 text-gray-700 leading-relaxed">
                          <span
                            aria-hidden="true"
                            className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-amber-500"
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ),
                )}
              </div>
            </section>
          ))}
        </article>
      </div>
    </div>
  )
}

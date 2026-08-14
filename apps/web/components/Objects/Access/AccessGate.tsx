'use client'

import Link from 'next/link'
import { ArrowRight, Lock, LogIn, Sparkles } from 'lucide-react'
import { getUriWithOrg } from '@services/config/config'

export interface AccessGateCopy {
  signInLabel: string
  paidLabel: string
  signInTitle: string
  signInBody: string
  restrictedTitle: string
  restrictedBody: string
  offerEyebrow: string
  offerBody: string
  offerCta: string
  signInCta: string
}

interface AccessGateProps {
  title: string
  orgslug: string
  isAuthenticated: boolean
  signInPath?: string
  backHref: string
  backLabel: string
  copy: AccessGateCopy
  excerpt?: string | null
  thumbnail?: string | null
  backButton?: boolean
  /**
   * Extra class on the panel that stands in for the withheld body. Articles pass
   * `article-gated-body` because their JSON-LD points `hasPart.cssSelector` at
   * it to tell Google which part of the page is not free — so the class is a
   * contract owned by the article page, not decoration owned by this component.
   */
  gatedBodyClassName?: string
}

/**
 * Shared access surface for content that can be teased but not opened.
 * Articles and activities supply their own translated copy and resource data,
 * while the distinction between anonymous and signed-in visitors, catalog CTA,
 * and visual treatment stay in one place.
 */
export default function AccessGate({
  title,
  orgslug,
  isAuthenticated,
  signInPath,
  backHref,
  backLabel,
  copy,
  excerpt,
  thumbnail,
  backButton = false,
  gatedBodyClassName = '',
}: AccessGateProps) {
  const loginHref = signInPath
    ? `${getUriWithOrg(orgslug, '/login')}?redirect=${encodeURIComponent(signInPath)}`
    : getUriWithOrg(orgslug, '/login')

  return (
    <div className="max-w-2xl mx-auto mt-5 mb-16 px-4 sm:mt-16">
      <div className="mb-8 text-center">
        {thumbnail && (
          <img
            src={thumbnail}
            alt=""
            className="mx-auto rounded-xl object-cover max-h-64 vz-frame"
          />
        )}
        <span className="mono-label">
          {isAuthenticated ? copy.paidLabel : copy.signInLabel}
        </span>
        <h1 className="text-2xl font-bold text-gray-900 mt-3 first-letter:uppercase">
          {title}
        </h1>
        <div className="vz-hairline mt-4 max-w-xs mx-auto" />
        {excerpt && <p className="mt-4 text-lg text-gray-600 leading-relaxed">{excerpt}</p>}
      </div>

      <div className={`${gatedBodyClassName} vz-frame bg-white p-8 text-center`.trim()}>
        {!isAuthenticated ? (
          <>
            <div className="mx-auto w-14 h-14 rounded-full bg-signal/10 flex items-center justify-center mb-4">
              <Lock className="text-signal" size={24} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{copy.signInTitle}</h2>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed max-w-sm mx-auto">
              {copy.signInBody}
            </p>
            <Link
              href={loginHref}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
            >
              <LogIn size={15} />
              {copy.signInCta}
            </Link>
          </>
        ) : (
          <>
            <div className="mx-auto w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mb-4">
              <Sparkles className="text-amber-500" size={24} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {copy.restrictedTitle}
            </h2>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed max-w-sm mx-auto">
              {copy.restrictedBody}
            </p>

            <div className="rounded-xl bg-gray-50 border border-gray-200/80 p-5 mb-6 text-left max-w-sm mx-auto">
              <p className="mono-label">{copy.offerEyebrow}</p>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">{copy.offerBody}</p>
              <Link
                href={getUriWithOrg(orgslug, '/courses')}
                className="mt-4 inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
              >
                {copy.offerCta}
                <ArrowRight size={15} />
              </Link>
            </div>

          </>
        )}
        <Link
          href={backHref}
          className={backButton
            ? 'mt-6 inline-flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors'
            : 'mt-6 inline-block text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors'}
        >
          {backLabel}
        </Link>
      </div>
    </div>
  )
}

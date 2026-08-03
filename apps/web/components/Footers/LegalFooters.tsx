'use client'
// Shared legal/footer bits, ported from the platform's look.
//
// AuthFooter   — the "By continuing, you agree to … Terms of Service and
//                Privacy Policy." line shown under the auth forms.
// CopyrightFooter — the "© {year} LearnHouse, Inc." line for app surfaces
//                (the apex /home hub, the onboarding page, …).
//
// The legal pages are served by this app, at /terms and /privacy. They used to
// point at the marketing site, but those paths are a client-side catch-all
// there and silently returned the landing page instead of a policy.
//
// Same-origin is also what Google's OAuth verification wants: the privacy
// policy must be hosted on the domain that hosts the homepage and be linked
// from it. Keeping these relative guarantees the two can never drift apart.
import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'

const TERMS_URL = '/terms'
const PRIVACY_URL = '/privacy'

export function AuthFooter({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <div className={`pb-8 pt-6 text-center px-6 ${className}`}>
      <p className="text-[13px] text-black/30 font-medium">
        {t('auth.terms_text', { defaultValue: "By continuing, you agree to Vozzrenye's" })}{' '}
        <Link
          href={TERMS_URL}
          className="text-black/50 hover:text-black/70 transition-colors"
        >
          {t('auth.terms_of_service', { defaultValue: 'Terms of Service' })}
        </Link>{' '}
        {t('auth.and', { defaultValue: 'and' })}{' '}
        <Link
          href={PRIVACY_URL}
          className="text-black/50 hover:text-black/70 transition-colors"
        >
          {t('auth.privacy_policy', { defaultValue: 'Privacy Policy' })}
        </Link>
        .
      </p>
    </div>
  )
}

export function CopyrightFooter({
  year,
  className = '',
  tone = 'light',
}: {
  year: number
  className?: string
  // `light` → dark text on light bg; `dark` → light text on dark bg.
  tone?: 'light' | 'dark'
}) {
  const { t } = useTranslation()
  const base = tone === 'dark' ? 'text-white/40' : 'text-black/35'
  const link = tone === 'dark' ? 'text-white/60 hover:text-white/80' : 'text-black/55 hover:text-black/75'
  return (
    <footer className={`w-full py-6 px-6 ${className}`}>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-x-5 gap-y-2 text-[13px] font-medium">
        <p className={base}>
          {t('common.copyright', { defaultValue: '© {{year}} Vozzrenye', year })}
        </p>
        <nav className="flex items-center gap-x-5">
          <Link
            href={TERMS_URL}
            className={`${link} transition-colors`}
          >
            {t('auth.terms_of_service', { defaultValue: 'Terms of Service' })}
          </Link>
          <Link
            href={PRIVACY_URL}
            className={`${link} transition-colors`}
          >
            {t('auth.privacy_policy', { defaultValue: 'Privacy Policy' })}
          </Link>
        </nav>
      </div>
    </footer>
  )
}

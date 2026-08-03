import React from 'react'
import Link from 'next/link'

/**
 * Server-rendered legal footer for the public homepage.
 *
 * `CopyrightFooter` in LegalFooters.tsx is a client component (it translates
 * its labels), and the whole org shell below it is client-rendered behind a
 * session gate — so the org homepage ships HTML containing nothing but its
 * <title>. That is fine for a signed-in human and useless to anything that
 * does not run JavaScript.
 *
 * Google's OAuth verification requires the homepage to link to the privacy
 * policy, and a link that only exists after hydration is a fragile thing to
 * stake verification on. This component carries no hooks, so it renders on the
 * server and the links are in the delivered HTML.
 *
 * Labels are deliberately untranslated: server components cannot use the
 * react-i18next hooks, and these two are proper nouns of the documents they
 * point at.
 */
export default function StaticLegalFooter({ className = '' }: { className?: string }) {
  return (
    <footer className={`w-full py-6 px-6 ${className}`}>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-x-5 gap-y-2 text-[13px] font-medium">
        <p className="text-gray-500">© {new Date().getFullYear()} Vozzrenye</p>
        <nav className="flex items-center gap-x-5">
          <Link href="/terms" className="text-gray-600 hover:text-amber-800 transition-colors">
            Terms of Service
          </Link>
          <Link href="/privacy" className="text-gray-600 hover:text-amber-800 transition-colors">
            Privacy Policy
          </Link>
        </nav>
      </div>
    </footer>
  )
}

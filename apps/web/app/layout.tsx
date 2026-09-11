import '../styles/globals.css'
import '../styles/learner.css'
import React from 'react'
import type { Metadata } from 'next'
import Providers from '@components/Providers'
import { Wix_Madefor_Text } from 'next/font/google'
import {
  getLEARNHOUSE_HTTP_PROTOCOL_VAL,
  getLEARNHOUSE_DOMAIN_VAL,
} from '@services/config/config'

// FORK CHANGE (SEO): upstream's root layout exports no metadata, so Next resolves
// relative OG/Twitter image paths against its localhost fallback origin — production
// was advertising og:image = http://localhost:8000/empty_thumbnail.png. These are
// RUNTIME getters (runtime-config.js / injected NEXT_PUBLIC_*), so metadataBase
// resolves per deployment with no rebuild. NEXT_PUBLIC_LEARNHOUSE_HTTPS drives the
// scheme; without it an https-only box still advertises http://.
export const metadata: Metadata = {
  metadataBase: new URL(
    `${getLEARNHOUSE_HTTP_PROTOCOL_VAL()}${getLEARNHOUSE_DOMAIN_VAL()}`
  ),
}

const wixMadeforText = Wix_Madefor_Text({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  variable: '--font-default',
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html className={wixMadeforText.variable} lang="en" suppressHydrationWarning>
      <head>
        {/* Synchronous script — blocks parsing to guarantee window.__RUNTIME_CONFIG__ exists before any JS runs.
            Next.js <Script strategy="beforeInteractive"> is not truly blocking in all browsers (Safari). */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/runtime-config.js" />
        {/* Prevent white flash on embed routes: set html+body bg before body is painted.
            Reads the optional ?bgcolor param (hex-validated) or defaults to dark. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/embed-bg.js" />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          <main className="animate-fade-in">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}

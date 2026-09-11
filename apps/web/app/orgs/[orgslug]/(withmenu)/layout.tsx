'use client';
import { use, useEffect, type ReactNode, type CSSProperties } from "react";
import { useTranslation } from 'react-i18next'
import Watermark from '@components/Objects/Watermark'
import { SessionGate } from '@components/Contexts/LHSessionContext'
import { OrgMenu } from '@components/Objects/Menus/OrgMenu'
import { useOrg } from '@components/Contexts/OrgContext'
import { OrgJoinBanner, OrgJoinBannerProvider } from '@components/Objects/Banners/OrgJoinBanner'
import { OrgMFAPolicyGate } from '@components/Objects/Banners/OrgMFAPolicyGate'
import { PodcastPlayerProvider } from '@components/Contexts/PodcastPlayerContext'
import dynamic from 'next/dynamic'
const PodcastPlayer = dynamic(() => import('@components/Objects/Podcasts/PodcastPlayer'), { ssr: false })
import Image from 'next/image'
import Link from 'next/link'
import { PageViewTracker } from '@components/Analytics/PageViewTracker'
import { usePathname, useSearchParams } from 'next/navigation'
import { usePlan } from '@components/Hooks/usePlan'
import { getGoogleFontUrl, DEFAULT_FONT } from '@/lib/fonts'
import StaticLegalFooter from '@components/Footers/StaticLegalFooter'
import { getLandingFooterLinks, normalizeLandingUrl } from '@/lib/landing/footer'

function OrgFooter() {
  const org = useOrg() as any
  const footerText = org?.config?.config?.customization?.general?.footer_text || org?.config?.config?.general?.footer_text || ''
  const plan = usePlan()
  const watermarkConfig = org?.config?.config?.customization?.general?.watermark ?? org?.config?.config?.general?.watermark
  const isFree = plan === 'free'
  const showWatermark = isFree || watermarkConfig !== false
  const landing = org?.config?.config?.customization?.landing || org?.config?.config?.landing
  const footerLinks = getLandingFooterLinks(landing)

  return (
    <footer className="mt-12 w-full border-t border-neutral-200/70 py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {footerText && <p className="text-sm text-gray-500">{footerText}</p>}
          {showWatermark && (
            <Link href="https://vozzrenye.pro" target="_blank" rel="noopener noreferrer" aria-label="Воззрение">
              <Image src="/lrn.svg" alt="Воззрение" width={24} height={24} style={{ height: 'auto' }} className="opacity-15 hover:opacity-40 transition-opacity duration-300 cursor-pointer" />
            </Link>
          )}
        </div>
        <nav aria-label="Меню футера" className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-neutral-600">
          {footerLinks.map((link, index) => {
            const href = normalizeLandingUrl(link.href)
            return href ? (
              <a key={`${link.label}-${index}`} href={href} className="transition-colors hover:text-neutral-950">{link.label}</a>
            ) : (
              <span key={`${link.label}-${index}`} aria-disabled="true" className="cursor-default text-neutral-400">{link.label}</span>
            )
          })}
        </nav>
      </div>
    </footer>
  )
}

function LayoutContent({ children, orgslug }: { children: ReactNode; orgslug: string }) {
  const org = useOrg() as any
  const customFont = org?.config?.config?.customization?.general?.font || org?.config?.config?.general?.font || ''
  const { t } = useTranslation()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // chrome=none strips the org navigation/footer so this route can be embedded
  // inside another view (e.g. a Resource activity iframe) without duplicate chrome.
  const chromeless = searchParams?.get('chrome') === 'none'

  // Inject Google Font stylesheet into document head
  useEffect(() => {
    if (!customFont || customFont === DEFAULT_FONT) return

    const fontId = `gfont-${customFont.replace(/\s/g, '-')}`
    if (document.getElementById(fontId)) return

    // Add preconnect hints
    const preconnect1 = document.createElement('link')
    preconnect1.rel = 'preconnect'
    preconnect1.href = 'https://fonts.googleapis.com'
    document.head.appendChild(preconnect1)

    const preconnect2 = document.createElement('link')
    preconnect2.rel = 'preconnect'
    preconnect2.href = 'https://fonts.gstatic.com'
    preconnect2.crossOrigin = 'anonymous'
    document.head.appendChild(preconnect2)

    // Add font stylesheet
    const link = document.createElement('link')
    link.id = fontId
    link.rel = 'stylesheet'
    link.href = getGoogleFontUrl(customFont)
    document.head.appendChild(link)

    return () => {
      document.head.removeChild(preconnect1)
      document.head.removeChild(preconnect2)
      const existing = document.getElementById(fontId)
      if (existing) document.head.removeChild(existing)
    }
  }, [customFont])

  const pathParts = pathname?.split('/').filter(Boolean) || []

  // Pages that use a full-bleed layout (no footer/watermark)
  const noFooterPaths = ['copilot']
  const isFullBleedPage = noFooterPaths.some((p) => pathParts.includes(p))

  return (
    <div
      className="vz-learner flex flex-col min-h-dvh"
      style={{
        backgroundColor: 'var(--vz-page)',
        ...(customFont ? { '--font-sans': `'${customFont}', system-ui, sans-serif`, fontFamily: `'${customFont}', system-ui, sans-serif` } : {}),
      } as CSSProperties}
    >
      <a href="#learner-content" className="vz-skip">{t('design.skip_content')}</a>
      <PageViewTracker />
      {!chromeless && <OrgJoinBanner />}
      {!chromeless && <OrgMenu orgslug={orgslug} />}
      {/* Org-wide 2FA policy: renders nothing unless this user is non-compliant. */}
      {!chromeless && <OrgMFAPolicyGate />}
      <div tabIndex={-1} id="learner-content" className="flex-1 relative" style={{ zIndex: 'var(--z-content)' }}>
        {children}
      </div>
      {!isFullBleedPage && !chromeless && <OrgFooter />}
      {!isFullBleedPage && !chromeless && <Watermark />}
    </div>
  )
}

export default function RootLayout(
  props: {
    children: ReactNode
    params: Promise<any>
  }
) {
  const params = use(props.params);

  const {
    children
  } = props;

  return (
    <>
      <SessionGate>
      <OrgJoinBannerProvider>
        <PodcastPlayerProvider>
          <LayoutContent orgslug={params?.orgslug}>
            {children}
          </LayoutContent>
          <PodcastPlayer />
        </PodcastPlayerProvider>
      </OrgJoinBannerProvider>
      </SessionGate>
      {/* Kept OUTSIDE SessionGate. Historically the gate swapped its children
          for <PageLoading /> whenever the session status was 'loading' — always
          the case during server rendering — so everything inside it was absent
          from the delivered HTML, and Google's OAuth review (which fetches the
          page without running our JavaScript) could not see the privacy link.
          The gate is now transparent by default, but this footer stays outside
          it so the legal link survives regardless of future gate changes. */}
      <StaticLegalFooter />
    </>
  )
}

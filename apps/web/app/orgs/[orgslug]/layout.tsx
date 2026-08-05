import type React from 'react'
import { Metadata } from 'next'
import { OrgProvider } from '@components/Contexts/OrgContext'
import OrgLanguageSync from '@components/Contexts/OrgLanguageSync'
import NextTopLoader from 'nextjs-toploader'
import Toast from '@components/Objects/StyledElements/Toast/Toast'
import '@styles/globals.css'
import Footer from '@components/Footer/Footer'
import CompleteSignupFields from '@components/Auth/CompleteSignupFields'
import { getOrgFaviconMediaDirectory } from '@services/media/media'
import { loadOrg } from '@/lib/data/pageData.server'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgslug: string }>
}): Promise<Metadata> {
  const { orgslug } = await params
  try {
    // Shares the request-memoised loader with the layout body below.
    const org = await loadOrg(orgslug)
    const faviconImage = org?.config?.config?.customization?.general?.favicon_image || org?.config?.config?.general?.favicon_image
    if (faviconImage) {
      return {
        icons: { icon: getOrgFaviconMediaDirectory(org.org_uuid, faviconImage) },
      }
    }
  } catch {
    // A favicon lookup failure must not break the page's metadata.
  }
  return {}
}

export default async function RootLayout(props: {
  children: React.ReactNode
  params: Promise<{ orgslug: string }>
}) {
  const params = await props.params
  // FORK CHANGE (SEO): seed the org into OrgProvider so `useOrg()` is populated
  // during SSR. Same React-cached call generateMetadata makes above — one fetch.
  const initialOrg = await loadOrg(params.orgslug).catch(() => null)

  return (
    <div>
      <OrgProvider orgslug={params.orgslug} initialOrg={initialOrg}>
        <OrgLanguageSync />
        <NextTopLoader color="#2e2e2e" initialPosition={0.3} height={4} easing={'ease'} speed={500} showSpinner={false} />
        <Toast />
        <CompleteSignupFields />
        {props.children}
        <Footer />
      </OrgProvider>
    </div>
  )
}

import { Metadata } from 'next'
import LegalDocument from '@components/Legal/LegalDocument'
import { privacyEn, privacyRu } from './content'

/**
 * Public privacy policy.
 *
 * Google's OAuth verification requires the privacy policy to be hosted on the
 * same domain as the app's homepage and to be reachable from that homepage
 * (see the footer on the org landing). It must stay publicly readable without
 * signing in, so this route is deliberately outside the authenticated shell.
 */

export const metadata: Metadata = {
  title: 'Privacy Policy — Vozzrenye',
  description:
    'How the Vozzrenye learning platform collects, uses, stores and shares personal data, including data received through Google sign-in.',
  robots: { index: true, follow: true },
}

export default function PrivacyPage() {
  return <LegalDocument ru={privacyRu} en={privacyEn} />
}

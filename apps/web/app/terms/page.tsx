import { Metadata } from 'next'
import LegalDocument from '@components/Legal/LegalDocument'
import { termsEn, termsRu } from './content'

/**
 * Public terms of service. Like the privacy policy, this must stay readable
 * without an account — Google's OAuth review checks both links from the
 * homepage.
 */

export const metadata: Metadata = {
  title: 'Terms of Service — Vozzrenye',
  description:
    'The terms governing use of the Vozzrenye learning platform: accounts, acceptable use, content rights, availability and liability.',
  robots: { index: true, follow: true },
}

export default function TermsPage() {
  return <LegalDocument ru={termsRu} en={termsEn} />
}

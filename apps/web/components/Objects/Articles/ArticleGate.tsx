'use client'

import { useTranslation } from 'react-i18next'
import { getUriWithOrg } from '@services/config/config'
import AccessGate from '@components/Objects/Access/AccessGate'

interface ArticleGateProps {
  article: any
  orgslug: string
  isAuthenticated: boolean
}

/** Article-specific data and copy for the shared access gate. */
export default function ArticleGate({ article, orgslug, isAuthenticated }: ArticleGateProps) {
  const { t } = useTranslation()
  const slug = article?.slug
  const signInPath =
    slug && !slug.startsWith('article_')
      ? `/articles/${slug}`
      : article?.article_uuid
        ? `/articles/${article.article_uuid}`
        : ''

  return (
    <AccessGate
      title={article.name}
      orgslug={orgslug}
      isAuthenticated={isAuthenticated}
      signInPath={signInPath}
      backHref={getUriWithOrg(orgslug, '/articles')}
      backLabel={t('articles.back_to_articles', 'Back to articles')}
      thumbnail={article.thumbnail_image ? resolveThumbnail(article.thumbnail_image) : null}
      excerpt={article.excerpt}
      // Load-bearing, not decoration: the JSON-LD in the article's page.tsx
      // points `hasPart.cssSelector` at this class to tell Google which part of
      // the page is withheld. Without it the selector resolves to nothing on
      // exactly the pages carrying the paywall, and `isAccessibleForFree: false`
      // is ignored. An activity gate has no such markup and passes nothing.
      gatedBodyClassName="article-gated-body"
      copy={{
        signInLabel: t('articles.gate_signin_label', 'MEMBERS / SIGN IN TO READ'),
        paidLabel: t('articles.gate_paid_label', 'PRO / PAID ACCESS'),
        signInTitle: t('articles.gate_signin_title', "There's more to this one"),
        signInBody: t(
          'articles.gate_signin_body',
          "The full text is open to platform readers. Sign in — it's free and takes less than a minute."
        ),
        restrictedTitle: t('articles.gate_restricted_title', 'Exclusive material'),
        restrictedBody: t(
          'articles.gate_restricted_body',
          "This article is part of a group's paid access. Members read it in full, along with the rest of the group's exclusive materials."
        ),
        offerEyebrow: t('articles.gate_offer_eyebrow', 'How to get access'),
        offerBody: t(
          'articles.gate_offer_body',
          'Group access unlocks exclusive articles, courses, and community materials.'
        ),
        offerCta: t('articles.gate_offer_cta', 'Browse courses'),
        signInCta: t('auth.sign_in', 'Sign in'),
      }}
    />
  )
}

function resolveThumbnail(thumb: string): string {
  if (/^https?:\/\//i.test(thumb) || thumb.startsWith('/')) return thumb
  return '/empty_thumbnail.png'
}

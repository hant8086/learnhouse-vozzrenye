'use client'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useArticles } from '@/hooks/queries/useArticle'
import ArticleCard from '@components/Objects/Articles/ArticleCard'
import NewArticleModal from '@components/Objects/Modals/Articles/NewArticleModal'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import TypeOfContentTitle from '@components/Objects/StyledElements/Titles/TypeOfContentTitle'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { BookCopy, LogIn } from 'lucide-react'
import Link from 'next/link'
import { getUriWithOrg } from '@services/config/config'
import { asArray } from '@services/utils/ts/requests'

interface ArticlesProps {
  orgslug: string
  /** Server-fetched catalog, so the delivered HTML already carries the cards. */
  initialArticles?: any
}

interface ArticleLike {
  article_uuid: string
  slug: string
  name: string
  excerpt: string | null
  thumbnail_image: string | null
  is_locked: boolean
}

function Articles(props: ArticlesProps) {
  const { t } = useTranslation()
  const orgslug = props.orgslug
  const org = useOrg() as any
  const session = useLHSession() as any
  const { isAdmin: isUserAdmin } = useAdminStatus()
  const isAuthenticated = session?.status === 'authenticated'
  const [newArticleModal, setNewArticleModal] = useState(false)

  // FORK CHANGE (SEO): seeded from the server fetch in `page.tsx`, so the first
  // render — the one that reaches the delivered HTML — already lists every
  // teaser. The API delivers locked articles with `is_locked=true` and empty
  // content, so gated articles show up as cards (name/excerpt), never hidden
  // rows. Drafts are not requested here: this is the public catalog.
  const { data: articlesData, isLoading } = useArticles(org?.id, props.initialArticles)

  const allArticles = asArray<ArticleLike>(articlesData)

  if (isLoading && !articlesData) {
    return (
      <div className="w-full animate-pulse">
        <GeneralWrapperStyled>
          <div className="flex flex-col space-y-2 mb-2">
            <div className="flex items-center justify-between mb-2">
              <div className="h-7 bg-gray-200 rounded w-28" />
              <div className="h-9 bg-gray-200 rounded-lg w-32" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-xl overflow-hidden">
                  <div className="bg-gray-200 w-full h-40 rounded-xl" />
                  <div className="pt-3 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GeneralWrapperStyled>
      </div>
    )
  }

  return (
    <div className="w-full">
      <GeneralWrapperStyled>
        <div className="flex flex-col space-y-2 mb-2">
          <div className="flex items-center justify-between">
            <TypeOfContentTitle title={t('articles.articles', 'Articles')} type="cou" />
            <AuthenticatedClientElement
              checkMethod="roles"
              action="create"
              ressourceType="articles"
              orgId={org?.id}
            >
              <Modal
                isDialogOpen={newArticleModal}
                onOpenChange={setNewArticleModal}
                minHeight="md"
                minWidth="lg"
                dialogContent={
                  <NewArticleModal
                    closeModal={() => setNewArticleModal(false)}
                    orgslug={orgslug}
                  />
                }
                dialogTitle={t('articles.create_article', 'New article')}
                dialogDescription={t('articles.create_article_description', 'Create a new standalone article')}
                dialogTrigger={
                  <button className="rounded-lg bg-black transition-all duration-100 ease-linear antialiased p-2 px-5 my-auto font text-xs font-bold text-white nice-shadow flex space-x-2 items-center hover:scale-105">
                    <BookCopy className="w-4 h-4" />
                    <span>{t('articles.create_article', 'New article')}</span>
                  </button>
                }
              />
            </AuthenticatedClientElement>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {allArticles.map((article) => (
              <ArticleCard key={article.article_uuid} article={article} orgslug={orgslug} />
            ))}

            {allArticles.length === 0 && (
              <div className="col-span-full flex flex-col justify-center items-center py-12 px-4 border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/30">
                <div className="p-4 bg-white rounded-full nice-shadow mb-4">
                  <BookCopy className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
                </div>
                <h1 className="text-xl font-bold text-gray-600 mb-2">
                  {t('articles.empty', 'No articles yet.')}
                </h1>
                <p className="text-md text-gray-400 mb-6 text-center max-w-xs">
                  {isAuthenticated
                    ? isUserAdmin
                      ? t('articles.empty_admin_hint', 'Create your first article to get started.')
                      : t('articles.empty_member_hint', 'Articles published by your organization will appear here.')
                    : t('articles.sign_in_to_see_articles', 'Sign in to see articles for this organization.')}
                </p>
                {!isAuthenticated && (
                  <Link
                    href={getUriWithOrg(orgslug, '/login')}
                    className="inline-flex items-center gap-2 justify-center px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
                  >
                    <LogIn size={16} />
                    {t('auth.sign_in', 'Sign in')}
                  </Link>
                )}
                {isAuthenticated && isUserAdmin && (
                  <button
                    onClick={() => setNewArticleModal(true)}
                    className="inline-flex items-center gap-2 justify-center px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
                  >
                    <BookCopy size={16} />
                    {t('articles.create_article', 'New article')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </GeneralWrapperStyled>
    </div>
  )
}

export default Articles
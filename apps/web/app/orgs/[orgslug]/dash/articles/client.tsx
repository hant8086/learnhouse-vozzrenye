'use client'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import NewArticleModal from '@components/Objects/Modals/Articles/NewArticleModal'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import { BookCopy, Search, X, Trash2, Edit2, Eye } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { useArticles } from '@/hooks/queries/useArticle'
import { getUriWithOrg } from '@services/config/config'
import { updateArticle, deleteArticle, ArticleLockType } from '@services/articles/articles'
import { asArray, revalidateTags } from '@services/utils/ts/requests'
import Link from 'next/link'
import { useState, useMemo } from 'react'
import toast from 'react-hot-toast'

type ArticleProps = {
  orgslug: string
}

const LOCK_TYPES: { value: ArticleLockType; label: string }[] = [
  { value: 'public', label: 'Public' },
  { value: 'authenticated', label: 'Authenticated' },
  { value: 'restricted', label: 'Restricted' },
]

function ArticlesHome(params: ArticleProps) {
  const { t } = useTranslation()
  const orgslug = params.orgslug
  const org = useOrg() as any
  const session = useLHSession() as any
  const access_token = session.data?.tokens?.access_token
  const queryClient = useQueryClient()
  const [newArticleModal, setNewArticleModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const { data: articlesData, isLoading } = useArticles(org?.id)

  // BACKEND LIMITATION (flagged in the task report): the articles router only
  // exposes `published_only=True` (GET /articles/?org_id=… has no
  // include_unpublished flag), so this table cannot show unpublished articles.
  // The per-row publish toggle below can still flip a row's published state.
  const allArticles = asArray<any>(articlesData)

  const filteredArticles = useMemo(() => {
    if (!searchQuery.trim()) return allArticles
    const q = searchQuery.toLowerCase()
    return allArticles.filter(
      (a: any) =>
        a.name?.toLowerCase().includes(q) || a.slug?.toLowerCase().includes(q)
    )
  }, [allArticles, searchQuery])

  const mutateArticles = () => {
    if (org?.id) queryClient.invalidateQueries({ queryKey: queryKeys.article.list(org.id) })
    revalidateTags(['articles'], orgslug)
  }

  async function changePublicStatus(article: any) {
    try {
      const result = await updateArticle(
        article.article_uuid,
        { published: !article.published },
        access_token
      )
      if (result.success === false) {
        toast.error(t('articles.update_error', 'Failed to update article'))
        return
      }
      toast.success(t('articles.update_success', 'Article updated'))
      mutateArticles()
    } catch {
      toast.error(t('articles.update_error', 'Failed to update article'))
    }
  }

  async function changeLockType(article: any, next: ArticleLockType) {
    try {
      const result = await updateArticle(
        article.article_uuid,
        { lock_type: next },
        access_token
      )
      if (result.success === false) {
        toast.error(t('articles.update_error', 'Failed to update article'))
        return
      }
      toast.success(t('articles.update_success', 'Article updated'))
      mutateArticles()
    } catch {
      toast.error(t('articles.update_error', 'Failed to update article'))
    }
  }

  async function deleteArticleUI(article: any) {
    const toastId = toast.loading(t('articles.deleting', 'Deleting article…'))
    try {
      await deleteArticle(article.article_uuid, access_token)
      toast.dismiss(toastId)
      toast.success(t('articles.delete_success', 'Article deleted'))
      mutateArticles()
    } catch (error: any) {
      toast.dismiss(toastId)
      toast.error(error?.message || t('articles.delete_error', 'Failed to delete article'))
    }
  }

  if (isLoading && !articlesData) {
    return (
      <div className="h-full w-full bg-[#f8f8f8] pl-4 pr-4 sm:pl-10 sm:pr-10">
        <div className="mb-6 pt-6 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-32 mb-6" />
          <div className="h-8 bg-gray-200 rounded w-48 mb-8" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="h-4 bg-gray-200 rounded w-1/3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full bg-[#f8f8f8] pl-4 pr-4 sm:pl-10 sm:pr-10">
      <div className="mb-6 pt-6">
        <Breadcrumbs items={[
          { label: t('articles.articles', 'Articles'), href: '/dash/articles', icon: <BookCopy size={14} /> }
        ]} />
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4">
          <h1 className="text-3xl font-bold mb-4 sm:mb-0">{t('articles.manage', 'Articles')}</h1>
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
      </div>

      {allArticles.length > 0 && (
        <div className="mb-6 flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('articles.search_articles', 'Search articles')}
              className="w-full pl-10 pr-10 py-2.5 bg-white nice-shadow rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 border-0"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl nice-shadow border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3 font-semibold">{t('articles.name', 'Name')}</th>
              <th className="px-4 py-3 font-semibold hidden md:table-cell">{t('articles.slug', 'Slug')}</th>
              <th className="px-4 py-3 font-semibold">{t('articles.published', 'Published')}</th>
              <th className="px-4 py-3 font-semibold">{t('articles.access', 'Access')}</th>
              <th className="px-4 py-3 font-semibold text-right">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredArticles.map((article: any) => (
              <tr key={article.article_uuid} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium text-gray-900">{article.name}</td>
                <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{article.slug}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => changePublicStatus(article)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      article.published ? 'bg-emerald-500' : 'bg-gray-300'
                    }`}
                    aria-label={t('articles.toggle_published', 'Toggle published')}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        article.published ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={article.lock_type || 'public'}
                    onChange={(e) => changeLockType(article, e.target.value as ArticleLockType)}
                    className="bg-white nice-shadow rounded-lg text-sm px-3 py-1.5 border-0 focus:outline-none focus:ring-2 focus:ring-black cursor-pointer"
                  >
                    {LOCK_TYPES.map((lt) => (
                      <option key={lt.value} value={lt.value}>
                        {t(`articles.lock_${lt.value}`, lt.label)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <Link
                      prefetch={false}
                      href={getUriWithOrg(orgslug, `/articles/${article.slug}`)}
                      className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                      aria-label={t('articles.view', 'View')}
                    >
                      <Eye size={16} />
                    </Link>
                    <Link
                      prefetch={false}
                      href={`/article/${article.article_uuid}/edit`}
                      className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                      aria-label={t('articles.edit', 'Edit')}
                    >
                      <Edit2 size={16} />
                    </Link>
                    <ConfirmationModal
                      confirmationButtonText={t('articles.delete', 'Delete')}
                      confirmationMessage={t('articles.delete_confirm', 'Are you sure you want to delete this article? This cannot be undone.')}
                      dialogTitle={t('articles.delete_title', 'Delete article')}
                      dialogTrigger={
                        <button className="p-2 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50" aria-label={t('articles.delete', 'Delete')}>
                          <Trash2 size={16} />
                        </button>
                      }
                      functionToExecute={() => deleteArticleUI(article)}
                      status="warning"
                    />
                  </div>
                </td>
              </tr>
            ))}
            {filteredArticles.length === 0 && !searchQuery && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <BookCopy className="w-10 h-10 text-gray-300" strokeWidth={1.5} />
                    <h2 className="text-lg font-semibold text-gray-600">{t('articles.empty', 'No articles yet.')}</h2>
                    <button onClick={() => setNewArticleModal(true)} className="text-sm text-gray-500 underline hover:text-gray-700">
                      {t('articles.create_first', 'Create your first article')}
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {filteredArticles.length === 0 && searchQuery && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <h2 className="text-lg font-semibold text-gray-600">{t('articles.no_search_results', 'No articles match your search.')}</h2>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ArticlesHome
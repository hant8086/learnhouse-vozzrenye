import { getAPIUrl } from '@services/config/config'
import {
  RequestBodyWithAuthHeader,
  getResponseMetadata,
} from '@services/utils/ts/requests'

export type ArticleLockType = 'public' | 'authenticated' | 'restricted'

export interface Article {
  id: number
  org_id: number
  article_uuid: string
  slug: string
  name: string
  excerpt: string | null
  content: any
  thumbnail_image: string | null
  published: boolean
  lock_type: ArticleLockType
  creation_date: string
  update_date: string
  seo: Record<string, any> | null
  authors: any[]
  current_version: number
  last_modified_by_username: string | null
  /** True when the caller may not read `content`; `content` is then `{}`
   *  and `excerpt` is the only body text available. */
  is_locked: boolean
}

export async function createArticle(body: any, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}articles/`,
    RequestBodyWithAuthHeader('POST', body, null, access_token)
  )
  const res = await result.json()
  return res
}

export async function updateArticle(
  article_uuid: string,
  body: any,
  access_token: string
) {
  const result = await fetch(
    `${getAPIUrl()}articles/${article_uuid}`,
    RequestBodyWithAuthHeader('PUT', body, null, access_token)
  )
  return getResponseMetadata(result)
}

export async function updateArticleContent(
  article_uuid: string,
  content: any,
  access_token: string
) {
  const result = await fetch(
    `${getAPIUrl()}articles/${article_uuid}`,
    RequestBodyWithAuthHeader('PUT', { content }, null, access_token)
  )
  return getResponseMetadata(result)
}

export async function deleteArticle(article_uuid: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}articles/${article_uuid}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token)
  )
  return getResponseMetadata(result)
}

export async function getArticleWithAuthHeader(
  article_uuid: string,
  next: any,
  access_token: string | null | undefined
) {
  const result = await fetch(
    `${getAPIUrl()}articles/${article_uuid}`,
    RequestBodyWithAuthHeader('GET', null, next, access_token || undefined)
  )
  const res = await result.json()
  return res
}

export async function getArticlesWithAuthHeader(
  org_id: number,
  next: any,
  access_token: string | null | undefined
) {
  const result = await fetch(
    `${getAPIUrl()}articles/?org_id=${org_id}`,
    RequestBodyWithAuthHeader('GET', null, next, access_token || undefined)
  )
  const res = await result.json()
  return res
}
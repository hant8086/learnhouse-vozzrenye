'use client'
import React from 'react'
import { useArticle } from '@/hooks/queries/useArticle'
import { getDefaultOrg } from '@services/config/config'
import EditorSkeleton from './EditorSkeleton'
import EditorWrapper from './EditorWrapper'

interface ArticleEditorLoaderProps {
  articleuuid: string
}

/**
 * FORK CHANGE (articles): entry point for the standalone-article editor.
 *
 * Mirrors `EditorLoader`, with two deliberate differences:
 *   - there is no editor-bootstrap endpoint for articles (bootstrap returns
 *     activity + course + org, and an article has no course), so the article is
 *     fetched directly and the org comes from the tenant context;
 *   - only the block-editor branch exists — articles have no markdown / embed /
 *     resource sub-types.
 */
export default function ArticleEditorLoader({ articleuuid }: ArticleEditorLoaderProps) {
  const [editorReady, setEditorReady] = React.useState(false)

  // The uuid may arrive with or without its `article_` prefix depending on how
  // the link was built; the API always wants the prefixed form.
  const articleUuid = articleuuid?.startsWith('article_')
    ? articleuuid
    : `article_${articleuuid}`

  const { data: article, error } = useArticle(articleUuid)

  // The editor's OrgProvider only needs the slug; it fetches the full org
  // (including resolved_features) itself. `/article/<uuid>/edit` is rewritten
  // by the proxy without an org segment, so the tenant comes from the cookie
  // the proxy sets — same source the rest of the client uses.
  const orgslug = getDefaultOrg()

  const dataReady = Boolean(article?.article_uuid)

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-500">
        <p className="text-sm">Failed to load the article. Please refresh the page.</p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-indigo-600 hover:underline"
        >
          Refresh
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Skeleton — fades out when the editor is ready */}
      <div
        style={{
          opacity: editorReady ? 0 : 1,
          transition: 'opacity 300ms ease-out',
          pointerEvents: editorReady ? 'none' : 'auto',
          position: editorReady ? 'fixed' : 'relative',
          inset: 0,
          zIndex: editorReady ? 50 : 'auto',
        }}
      >
        <EditorSkeleton />
      </div>

      {dataReady && (
        <div
          style={{
            opacity: editorReady ? 1 : 0,
            transition: 'opacity 300ms ease-out',
          }}
        >
          <EditorWrapper
            org={{ slug: orgslug }}
            article={article}
            content={article.content}
            onEditorReady={() => setEditorReady(true)}
          />
        </div>
      )}
    </div>
  )
}

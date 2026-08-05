'use client'
/**
 * FORK CHANGE (SEO): server-rendered, read-only rendering of a Canva activity.
 *
 * WHY THIS EXISTS
 * `DynamicCanva` renders through `useEditor({ immediatelyRender: false })`, which
 * returns null during server rendering, so `<EditorContent editor={null} />`
 * emits an empty container. The lesson prose — the entire payload this page is
 * meant to deliver — only appeared after hydration. Crawlers that do not execute
 * JavaScript (GPTBot, ClaudeBot, PerplexityBot, CCBot, Amazonbot) therefore got
 * the title, breadcrumb and chapter list and zero body text.
 *
 * `generateHTML` from `@tiptap/html` renders the same ProseMirror document to a
 * string with no DOM and no editor instance (its package `exports` map resolves
 * to a virtual-DOM server build under the `node` condition). Verified against
 * @tiptap/html 3.29.2 in a DOM-less Node process: prose, headings, lists, marks
 * and the content of custom nodes all survive, and `addNodeView()` is never
 * called — so the React node views, including the `next/dynamic({ ssr: false })`
 * ones, are not evaluated here.
 *
 * WHY IT IS NOT A SERVER COMPONENT
 * Fifteen of the extension modules call `next/dynamic(..., { ssr: false })` at
 * module scope, which Next forbids in the Server Component graph. This is a
 * Client Component instead — Next still executes it during SSR, which is all the
 * server-rendered markup requires.
 *
 * WHAT IT IS NOT
 * It is not a second source of truth. The extension list comes from the shared
 * `buildCanvaExtensions`, the same one the editor uses.
 *
 * It also never widens access: the caller renders it only after the locked check
 * has already returned, and a locked activity arrives from the API with
 * `content = {}` regardless, so there is nothing to generate.
 */
import { useMemo } from 'react'
import { generateHTML } from '@tiptap/html'
import { buildCanvaExtensions, normalizeCanvaContent } from './canvaExtensions'

interface CanvaStaticContentProps {
  content: any
  activity: any
  courseUuid?: string
  orgUuid?: string
  /** Rendered instead when the document cannot be generated. */
  fallback?: React.ReactNode
}

export default function CanvaStaticContent(props: CanvaStaticContentProps) {
  const html = useMemo(() => {
    const doc = normalizeCanvaContent(props.content)
    // A ProseMirror doc is an object with a `content` array. Anything else
    // (empty object from a scrubbed locked activity, a raw string, null) has
    // nothing to render.
    if (!doc || typeof doc !== 'object' || !Array.isArray((doc as any).content)) {
      return null
    }
    try {
      return generateHTML(
        doc,
        buildCanvaExtensions({
          activity: props.activity,
          courseUuid: props.courseUuid,
          orgUuid: props.orgUuid,
        })
      )
    } catch (error) {
      // Fail SOFT and loud. A malformed document or an extension that cannot
      // build its schema must degrade to the old spinner, never take down the
      // whole activity page with a server-side exception.
      console.error('[CanvaStaticContent] server HTML generation failed:', error)
      return null
    }
  }, [props.content, props.activity, props.courseUuid, props.orgUuid])

  if (!html) return <>{props.fallback ?? null}</>

  return (
    <div className="w-full mx-auto">
      <div className="canva-content-wrapper">
        {/* Generated from our own stored ProseMirror JSON through TipTap's schema
            serializer, which emits only node types declared by our extensions. */}
        <div className="ProseMirror" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  )
}

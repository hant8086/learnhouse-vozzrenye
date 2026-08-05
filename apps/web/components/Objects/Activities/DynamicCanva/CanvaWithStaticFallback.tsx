'use client'
/**
 * FORK CHANGE (SEO): renders lesson prose server-side, then upgrades to the
 * interactive TipTap viewer on the client.
 *
 * Server render and the first client render both emit `CanvaStaticContent`, so
 * the delivered HTML carries the real body text and hydration matches exactly.
 * An effect then flips to the editor, which brings back text selection, the AI
 * toolkit, the table of contents and every interactive block.
 *
 * The swap is driven by an explicit mount effect rather than by letting a
 * `React.lazy` boundary suspend during SSR: streaming SSR resolves a suspended
 * lazy chunk within the same response and swaps the fallback out, which would
 * put an empty editor container back into the delivered HTML. A deterministic
 * `interactive` flag keeps the server output predictable.
 *
 * While the editor chunk downloads, the static view is also the Suspense
 * fallback — so the reader sees prose throughout instead of a spinner.
 *
 * Ordering note: this component must only ever be rendered AFTER the caller's
 * locked/paid checks. It does not perform an access check of its own.
 */
import React, { lazy, Suspense, useEffect, useState } from 'react'
import CanvaStaticContent from './CanvaStaticContent'

const Canva = lazy(() => import('./DynamicCanva'))

interface CanvaWithStaticFallbackProps {
  content: any
  activity: any
  courseUuid?: string
  orgUuid?: string
  hideTableOfContents?: boolean
  /** Shown only when the document cannot be rendered statically at all. */
  fallback?: React.ReactNode
}

export default function CanvaWithStaticFallback(props: CanvaWithStaticFallbackProps) {
  const [interactive, setInteractive] = useState(false)

  useEffect(() => {
    setInteractive(true)
  }, [])

  const staticView = (
    <CanvaStaticContent
      content={props.content}
      activity={props.activity}
      courseUuid={props.courseUuid}
      orgUuid={props.orgUuid}
      fallback={props.fallback}
    />
  )

  if (!interactive) return staticView

  return (
    <Suspense fallback={staticView}>
      <Canva
        content={props.content}
        activity={props.activity}
        courseUuid={props.courseUuid}
        orgUuid={props.orgUuid}
        hideTableOfContents={props.hideTableOfContents}
      />
    </Suspense>
  )
}

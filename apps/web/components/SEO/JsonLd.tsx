// Server component by design: NO 'use client', no hooks, no state.
//
// FORK CHANGE (SEO): this file itself was already client-free, but its course /
// activity call sites lived inside the client subtree that SessionGate stripped
// from the SSR output, so production delivered 0 `application/ld+json` blocks.
// Keep it hook-free and keep call sites in `page.tsx` server components so the
// script survives in the raw HTML for crawlers that do not execute JS.
export function JsonLd({ data }: { data: Record<string, any> | null | undefined }) {
  if (!data) return null
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

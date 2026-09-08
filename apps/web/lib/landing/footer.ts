export interface LandingFooterLink {
  label: string
  href?: string | null
}

export const DEFAULT_LANDING_FOOTER_LINKS: LandingFooterLink[] = [
  { label: 'Миссия', href: null },
  { label: 'Сообщество', href: null },
  { label: 'Технология', href: null },
]

/** Accept only same-origin relative URLs or explicit HTTP(S) destinations. */
export function normalizeLandingUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const candidate = value.trim()
  // Backslashes are rejected because browsers normalize `/\\host` into a
  // network URL in some navigation contexts, bypassing the relative check.
  if (!candidate || candidate.startsWith('//') || candidate.includes('\\')) return null
  if (candidate.startsWith('/')) return candidate
  try {
    const parsed = new URL(candidate)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null
  } catch {
    return null
  }
}

export function normalizeLandingFooterLinks(value: unknown): LandingFooterLink[] {
  if (!Array.isArray(value)) return DEFAULT_LANDING_FOOTER_LINKS.map((link) => ({ ...link }))
  return DEFAULT_LANDING_FOOTER_LINKS.map((fallback, index) => {
    const item = value[index]
    if (!item || typeof item !== 'object') return { ...fallback }
    const source = item as { label?: unknown; href?: unknown }
    const label = typeof source.label === 'string' && source.label.trim() ? source.label.trim() : fallback.label
    return { label, href: normalizeLandingUrl(source.href) }
  })
}

export function getLandingFooterLinks(landing: unknown): LandingFooterLink[] {
  if (!landing || typeof landing !== 'object') return normalizeLandingFooterLinks(null)
  return normalizeLandingFooterLinks((landing as { footer_links?: unknown }).footer_links)
}

export type TagColorMap = Record<string, string>

const HEX_COLOR = /^#[0-9a-f]{6}$/i

/** Return a canonical safe #RRGGBB value, or null for untrusted input. */
export function normalizeTagColor(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const color = value.trim()
  return HEX_COLOR.test(color) ? color.toUpperCase() : null
}

/** Keep only non-empty tag names and strict six-digit hex values. */
export function normalizeTagColors(value: unknown): TagColorMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: TagColorMap = {}
  for (const [rawTag, rawColor] of Object.entries(value)) {
    const tag = rawTag.trim()
    const color = normalizeTagColor(rawColor)
    if (tag && color) result[tag] = color
  }
  return result
}

export function parseCourseTags(tags: unknown): string[] {
  if (typeof tags !== 'string') return []
  const seen = new Set<string>()
  return tags.split(/[,;|]/).map((tag) => tag.trim()).filter((tag) => {
    const key = tag.toLocaleLowerCase()
    if (!tag || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Merge tag colors into course metadata without dropping unrelated settings. */
export function mergeTagColorMetadata(existing: unknown, colors: unknown): Record<string, unknown> {
  const metadata = existing && typeof existing === 'object' && !Array.isArray(existing)
    ? { ...(existing as Record<string, unknown>) }
    : {}
  const normalized = normalizeTagColors(colors)
  if (Object.keys(normalized).length > 0) metadata.tag_colors = normalized
  else delete metadata.tag_colors
  return metadata
}

function rgb(color: string): [number, number, number] {
  return [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16)) as [number, number, number]
}

function adjust(color: string, amount: number): string {
  return `#${rgb(color).map((channel) => Math.max(0, Math.min(255, Math.round(channel + (255 - channel) * amount)))).map((channel) => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

/** Readable tag colors for both light and dark text, with a visible border. */
export function getTagColorStyle(tag: string, colors: unknown): {
  backgroundColor: string
  color: string
  borderColor: string
} {
  const normalizedColors = normalizeTagColors(colors)
  const colorEntry = Object.entries(normalizedColors).find(([name]) => name.toLocaleLowerCase() === tag.trim().toLocaleLowerCase())
  const backgroundColor = colorEntry?.[1] ?? '#F3F4F6'
  const [r, g, b] = rgb(backgroundColor)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  const foreground = luminance > 0.62 ? '#1F2937' : '#FFFFFF'
  return {
    backgroundColor,
    color: foreground,
    borderColor: luminance > 0.62 ? adjust(backgroundColor, -0.2) : adjust(backgroundColor, 0.2),
  }
}

export function getTagColor(tag: string, colors: unknown): string | null {
  const normalizedColors = normalizeTagColors(colors)
  return Object.entries(normalizedColors).find(([name]) => name.toLocaleLowerCase() === tag.trim().toLocaleLowerCase())?.[1] ?? null
}

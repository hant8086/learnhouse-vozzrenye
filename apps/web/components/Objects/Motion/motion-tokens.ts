/**
 * Vozzrenye motion tokens.
 *
 * Source of truth: vozzrenye-landing/docs/design/ORG-DESIGN-SYSTEM.md §6.
 * Motion reports meaning, not decoration: reveal communicates the hierarchy
 * in which a section arrives, hover/active confirm that something is
 * interactive. Persistent movement is never added to informational cards.
 *
 * Keep every animation in the app expressed through these values so timing
 * stays coherent across surfaces.
 */

/** The single interface easing. Mirrors --ease-interface in globals.css. */
export const EASE_INTERFACE = [0.16, 1, 0.3, 1] as const

export const DURATION = {
  /** State flips: toggles, checks, colour changes. */
  instant: 0.12,
  /** Hover and focus feedback. */
  quick: 0.22,
  /** The default for a reveal or a panel change. */
  base: 0.42,
  /** Hero-scale entrances only. */
  slow: 0.64,
} as const

/** Gap between siblings in a staggered group. */
export const STAGGER = 0.06

/** Distance an element travels on reveal. Small: motion marks order, not travel. */
export const REVEAL_OFFSET = 16

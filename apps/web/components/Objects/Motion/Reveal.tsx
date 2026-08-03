'use client'
import React from 'react'
import { motion, useReducedMotion, type Variants } from 'motion/react'
import { DURATION, EASE_INTERFACE, REVEAL_OFFSET, STAGGER } from './motion-tokens'

/**
 * Viewport reveal primitives (ORG-DESIGN-SYSTEM.md §6).
 *
 * `Reveal` animates one element as it enters the viewport. `RevealGroup`
 * wraps a set of siblings and hands each one its turn, so the order of
 * arrival communicates the hierarchy of the section.
 *
 * Both honour `prefers-reduced-motion`: when set, the content renders in its
 * final state with no transition rather than being hidden or delayed.
 *
 * Reveal is driven by motion's viewport observer, not by a scroll listener
 * feeding React state — that pattern is explicitly ruled out by §6 because
 * it re-renders the tree on every scroll frame.
 */

type Direction = 'up' | 'down' | 'left' | 'right' | 'none'

function offsetFor(direction: Direction) {
  switch (direction) {
    case 'up':
      return { y: REVEAL_OFFSET }
    case 'down':
      return { y: -REVEAL_OFFSET }
    case 'left':
      return { x: REVEAL_OFFSET }
    case 'right':
      return { x: -REVEAL_OFFSET }
    default:
      return {}
  }
}

function buildVariants(direction: Direction, duration: number): Variants {
  return {
    hidden: { opacity: 0, ...offsetFor(direction) },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { duration, ease: EASE_INTERFACE },
    },
  }
}

/** Rendered instead of the animated element when motion is suppressed. */
const STATIC_VARIANTS: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1 },
}

export type RevealProps = {
  children: React.ReactNode
  className?: string
  /** Where the element travels from. `none` fades only. */
  direction?: Direction
  /** Seconds to wait before starting. Ignored inside a RevealGroup. */
  delay?: number
  duration?: number
  /** Replay the reveal every time the element re-enters the viewport. */
  repeat?: boolean
  /** Fraction of the element that must be visible before it starts. */
  amount?: number
}

export function Reveal({
  children,
  className,
  direction = 'up',
  delay = 0,
  duration = DURATION.base,
  repeat = false,
  amount = 0.2,
}: RevealProps) {
  const reduced = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: !repeat, amount }}
      variants={reduced ? STATIC_VARIANTS : buildVariants(direction, duration)}
      transition={reduced ? { duration: 0 } : { delay }}
    >
      {children}
    </motion.div>
  )
}

export type RevealGroupProps = {
  children: React.ReactNode
  className?: string
  /** Seconds between siblings. */
  stagger?: number
  /** Seconds before the first sibling starts. */
  delay?: number
  repeat?: boolean
  amount?: number
}

/**
 * Parent of a staggered set. Direct children must be `RevealItem` — a plain
 * element will not inherit the orchestration and simply renders as-is.
 */
export function RevealGroup({
  children,
  className,
  stagger = STAGGER,
  delay = 0,
  repeat = false,
  amount = 0.15,
}: RevealGroupProps) {
  const reduced = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: !repeat, amount }}
      variants={{
        hidden: {},
        visible: {
          transition: reduced
            ? { staggerChildren: 0, delayChildren: 0 }
            : { staggerChildren: stagger, delayChildren: delay },
        },
      }}
    >
      {children}
    </motion.div>
  )
}

export type RevealItemProps = {
  children: React.ReactNode
  className?: string
  direction?: Direction
  duration?: number
}

export function RevealItem({
  children,
  className,
  direction = 'up',
  duration = DURATION.base,
}: RevealItemProps) {
  const reduced = useReducedMotion()

  return (
    <motion.div
      className={className}
      variants={reduced ? STATIC_VARIANTS : buildVariants(direction, duration)}
    >
      {children}
    </motion.div>
  )
}

'use client'

import type { RefObject } from 'react'
import { motion, useReducedMotion, useScroll, useSpring } from 'motion/react'

import { cn } from '@/lib/utils'
import { DURATION } from './motion-tokens'

/**
 * A fixed reading-progress marker. With no target it follows the document;
 * pass a reading-surface ref when the article/course content scrolls inside a
 * dedicated container. The component is intentionally decorative and does
 * not add a scroll listener or React state update.
 */
export type ScrollPathProps = {
  className?: string
  target?: RefObject<HTMLElement | null>
}

export function ScrollPath({ className, target }: ScrollPathProps) {
  const { scrollYProgress } = useScroll(target ? { target } : undefined)
  const reducedMotion = useReducedMotion()
  const springProgress = useSpring(scrollYProgress, {
    visualDuration: DURATION.base,
    bounce: 0.08,
  })
  const progress = reducedMotion ? scrollYProgress : springProgress

  return (
    <div
      aria-hidden="true"
      className={cn('vz-scroll-progress', className)}
    >
      <motion.span
        className="vz-scroll-progress__vertical"
        style={{ scaleY: progress }}
      />
      <motion.span
        className="vz-scroll-progress__horizontal"
        style={{ scaleX: progress }}
      />
    </div>
  )
}

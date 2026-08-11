'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

/**
 * A two-state theme control. The button stays in the tree during SSR and
 * hydration; only the icon is replaced by a fixed-size placeholder until
 * next-themes has read localStorage on the client.
 */
export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const themeReady = mounted && (resolvedTheme === 'light' || resolvedTheme === 'dark')
  const isDark = themeReady && resolvedTheme === 'dark'
  const label = themeReady
    ? isDark
      ? 'Switch to light theme'
      : 'Switch to dark theme'
    : 'Toggle theme'

  // No `dark:` variants on the button below, on purpose. The dark theme is
  // built by REVERSING the neutral ramp under `html.dark` (gray-50 becomes the
  // darkest surface, gray-950 the brightest text), so a plain `text-gray-700`
  // already resolves to light-on-dark. Adding `dark:text-gray-200` on top
  // inverted it a second time and painted the icon #11151E — near-black on the
  // near-black nav, i.e. invisible.
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={themeReady ? isDark : undefined}
      onClick={() => {
        if (!themeReady) return
        setTheme(isDark ? 'light' : 'dark')
      }}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-700 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-950 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-50 motion-reduce:transition-none"
    >
      <span className="flex h-5 w-5 items-center justify-center" aria-hidden="true">
        {themeReady ? (
          isDark ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />
        ) : (
          <span className="block h-[18px] w-[18px]" />
        )}
      </span>
    </button>
  )
}

'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import i18n, { changeLanguage } from '@/lib/i18n'

export default function OrgLanguageSync() {
  const pathname = usePathname()

  useEffect(() => {
    // Dashboard menus can opt into an authoring locale explicitly. Every
    // learner/auth route resets to Russian when navigation returns from it.
    if (!pathname?.includes('/dash') && i18n.language.split('-')[0] !== 'ru') {
      void changeLanguage('ru')
    }
  }, [pathname])

  return null
}

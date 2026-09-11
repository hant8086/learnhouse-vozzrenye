'use client'
import React from 'react'
import Link from 'next/link'
import { User, Lock, ShoppingBag, Settings } from 'lucide-react'
import { getUriWithOrg } from '@services/config/config'
import { useTranslation } from 'react-i18next'

interface AccountActionsMobileProps {
  orgslug: string
  currentSubpage: string
}

const NAV_ITEMS = [
  { id: 'general', icon: Settings, labelKey: 'account.general' },
  { id: 'profile', icon: User, labelKey: 'account.profile' },
  { id: 'security', icon: Lock, labelKey: 'account.security' },
  { id: 'purchases', icon: ShoppingBag, labelKey: 'account.purchases' },
]

export function AccountActionsMobile({ orgslug, currentSubpage }: AccountActionsMobileProps) {
  const { t } = useTranslation()

  return (
    <nav aria-label={t('account.title')} className="vz-account-mobile fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="mx-3 mb-4 bg-card border border-border rounded-xl p-2">
        <div className="grid grid-cols-4 gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = currentSubpage === item.id
            return (
              <Link
                key={item.id}
                  aria-current={isActive ? 'page' : undefined}
                href={getUriWithOrg(orgslug, `/account/${item.id}`)}
                className={`flex flex-col items-center gap-1 px-1 py-2 min-w-0 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon size={18} />
                <span className="text-xs font-medium text-center leading-tight break-words">
                  {t(item.labelKey)}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

export default AccountActionsMobile

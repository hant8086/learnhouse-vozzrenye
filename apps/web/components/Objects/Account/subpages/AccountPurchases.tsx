'use client'

import React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { getUserAccess } from '@services/payments/offers'
import type { UserAccess } from '@services/payments/offers'
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Loader2,
  ShoppingBag,
} from 'lucide-react'

interface AccountPurchasesProps {
  orgId: number
  orgslug: string
}

function AccessCard({ access, orgslug }: { access: UserAccess; orgslug: string }) {
  const { t, i18n } = useTranslation()
  const formattedDate = access.granted_at
    ? new Intl.DateTimeFormat(i18n.language === 'ru' ? 'ru-RU' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(new Date(access.granted_at))
    : null

  return (
    <div className="bg-white rounded-xl nice-shadow overflow-hidden">
      <div className="px-4 py-2 flex items-center justify-between bg-gray-50">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-signal">
          <BadgeCheck size={12} />
          {t('account.access_granted')}
        </span>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <p className="font-bold text-gray-900 leading-snug">{access.name}</p>
          <p className="text-sm text-gray-600 leading-relaxed mt-1">
            {access.description}
          </p>
        </div>

        {formattedDate && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <CalendarDays size={12} />
            <span>{t('account.access_granted_at', { date: formattedDate })}</span>
          </div>
        )}

        <Link
          href={getUriWithOrg(orgslug, '/')}
          className="flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-gray-900 hover:bg-gray-800 transition-colors px-3 py-2 rounded-lg"
        >
          {t('account.access_materials')}
          <ArrowRight size={11} />
        </Link>
      </div>
    </div>
  )
}

function AccountPurchases({ orgId, orgslug }: AccountPurchasesProps) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const { t } = useTranslation()

  const { data: accessResult, isLoading, error } = useQuery({
    queryKey: ['access', orgId, 'mine'],
    queryFn: () => getUserAccess(orgId, accessToken),
    enabled: !!orgId && !!accessToken,
    staleTime: 60_000,
  })

  const accesses: UserAccess[] = Array.isArray(accessResult?.data)
    ? accessResult.data
    : []

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl nice-shadow p-12 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-gray-300" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl nice-shadow p-8 text-center text-sm text-red-400">
        {t('account.access_error')}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl nice-shadow p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center nice-shadow">
            <ShoppingBag size={18} className="text-gray-700" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900">{t('account.access_title')}</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {t('account.access_subtitle')}
            </p>
          </div>
        </div>
      </div>

      {accesses.length === 0 ? (
        <div className="bg-white rounded-xl nice-shadow p-12 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-4 nice-shadow">
            <ShoppingBag size={24} className="text-gray-300" strokeWidth={1.5} />
          </div>
          <h2 className="font-bold text-gray-600 mb-1">
            {t('account.access_empty_title')}
          </h2>
          <p className="text-sm text-gray-400 max-w-xs">
            {t('account.access_empty_description')}
          </p>
          <Link
            href={getUriWithOrg(orgslug, '/store')}
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 transition-colors px-4 py-2 rounded-xl"
          >
            {t('account.access_catalog')}
            <ArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {accesses.map((access) => (
            <AccessCard
              key={access.usergroup_id}
              access={access}
              orgslug={orgslug}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default AccountPurchases

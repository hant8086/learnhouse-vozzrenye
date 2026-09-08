'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, AlertTriangle } from 'lucide-react'

const ERROR_MESSAGES: Record<string, string> = {
  missing_code: 'Код для входа не указан.',
  code_expired: 'Ссылка для входа истекла или уже использована. Вернитесь в панель управления и снова нажмите «Открыть сайт».',
  platform_unreachable: 'Не удалось связаться с основной платформой. Попробуйте ещё раз через некоторое время.',
  platform_bad_response: 'Платформа вернула неожиданный ответ. Попробуйте ещё раз.',
  no_tokens: 'В ссылке для входа нет данных для авторизации.',
  no_refresh_token: 'В ссылке для входа отсутствует refresh-токен. Вернитесь в панель управления и снова нажмите «Открыть сайт».',
  no_access_token: 'Не удалось получить действительный токен сессии.',
  session_invalid: 'Ваш аккаунт не найден в этой организации. Выполните вход напрямую.',
  user_not_in_tenant: 'Ваш аккаунт не состоит в этой организации. Выполните вход напрямую.',
  backend_unreachable: 'Не удалось связаться с сервером. Попробуйте ещё раз.',
  bad_origin: 'Сервер отклонил этот запрос.',
  bad_content_type: 'Сервер отклонил этот запрос.',
  unexpected: 'Произошла непредвиденная ошибка. Попробуйте ещё раз.',
}

// Only allow same-origin relative paths. Rejects `//evil.com`, `https://evil.com`,
// and backslash tricks — prevents the `?redirect=` param from becoming an open
// redirect after a successful exchange.
function sanitizeRedirect(raw: string | null): string {
  const fallback = '/dash'
  if (!raw) return fallback
  if (!raw.startsWith('/')) return fallback
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback
  if (/[\r\n]/.test(raw)) return fallback
  return raw
}

function TokenExchangeInner() {
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleExchange = async () => {
      const code = searchParams.get('code')
      const redirect = sanitizeRedirect(searchParams.get('redirect'))

      if (!code) {
        setError('Код авторизации не указан')
        return
      }

      try {
        // Call our own API which server-side exchanges the code for tokens
        const res = await fetch('/api/auth/token-exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
          credentials: 'include',
        })

        if (!res.ok) {
          const body = await res.json().catch(() => null)
          const errCode = body?.code as string | undefined
          setError(
            (errCode && ERROR_MESSAGES[errCode]) ||
              body?.error ||
              'Не удалось выполнить вход. Попробуйте войти ещё раз.'
          )
          return
        }

        // Full page reload so AuthContext initializes fresh with the new cookies
        window.location.href = redirect
      } catch {
        setError('Что-то пошло не так. Попробуйте ещё раз.')
      }
    }

    handleExchange()
  }, [searchParams])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-red-100 rounded-full">
              <AlertTriangle className="w-10 h-10 text-red-600" />
            </div>
          </div>
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Не удалось выполнить вход</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <a
            href="/login"
            className="inline-block px-6 py-2.5 bg-black text-white rounded-lg hover:bg-black/90 transition-colors text-sm font-semibold"
          >
            Вернуться ко входу
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <Loader2 className="w-10 h-10 text-gray-600 animate-spin" />
        </div>
        <h1 className="text-lg font-semibold text-gray-800 mb-1">Выполняем вход…</h1>
        <p className="text-gray-500 text-sm">Пожалуйста, подождите — мы подготавливаем вашу сессию.</p>
      </div>
    </div>
  )
}

export default function TokenExchangePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="w-10 h-10 text-gray-600 animate-spin" />
        </div>
      }
    >
      <TokenExchangeInner />
    </Suspense>
  )
}

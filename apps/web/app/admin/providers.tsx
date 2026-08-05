'use client'
import { SessionProvider } from '@components/Contexts/AuthContext'
import LHSessionProvider, { SessionGate } from '@components/Contexts/LHSessionContext'
import React from 'react'

export default function AdminProviders({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      <LHSessionProvider>
        {/* Private surface, never crawled — keep the blocking gate. */}
        <SessionGate waitForSession>
          {children}
        </SessionGate>
      </LHSessionProvider>
    </SessionProvider>
  )
}

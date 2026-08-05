'use client'
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { useSession, UseSessionReturn } from '@components/Contexts/AuthContext';
import React, { useContext, createContext } from 'react'

export const SessionContext = createContext<UseSessionReturn | null>(null)

/**
 * Provides session context to all children. Does NOT block rendering —
 * children receive session data (including loading state) and decide
 * how to handle it themselves.
 */
function LHSessionProvider({ children }: { children: React.ReactNode }) {
    const session = useSession();

    return (
        <SessionContext.Provider value={session}>
            {children}
        </SessionContext.Provider>
    )
}

/**
 * Session-aware wrapper.
 *
 * FORK CHANGE (SEO): `status` is ALWAYS 'loading' during server rendering, so a
 * gate that swaps children for a spinner in that state removes its whole
 * subtree — server components included — from the delivered HTML. That is why
 * production served ~100 visible characters per course/activity page: crawlers
 * that do not execute JS (GPTBot, ClaudeBot, PerplexityBot, CCBot, Amazonbot)
 * saw only the footer. Upstream's blocking behaviour is therefore now opt-in.
 *
 * Default (`waitForSession` unset): renders `children` immediately, including
 * during SSR and the first client render. Consumers that genuinely need a
 * resolved session must guard on `status` themselves — every one of them in
 * this tree already fails closed on a non-'authenticated' status.
 *
 * `waitForSession`: the old behaviour — spinner until the session resolves.
 * Kept for private surfaces (/admin, /dash) that are never crawled and whose
 * authorization components assume a settled session.
 */
export function SessionGate({ children, fallback, waitForSession = false }: { children: React.ReactNode; fallback?: React.ReactNode; waitForSession?: boolean }) {
    const session = useContext(SessionContext)

    if (waitForSession && session && session.status === 'loading') {
        return fallback ? <>{fallback}</> : <PageLoading />
    }

    return <>{children}</>
}

export function useLHSession() {
    return useContext(SessionContext)
}

export default LHSessionProvider

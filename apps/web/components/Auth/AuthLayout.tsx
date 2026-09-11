'use client'
import React from 'react'
import AuthBrandingPanel from '@components/Auth/AuthBrandingPanel'
import AuthMobileHeader from '@components/Auth/AuthMobileHeader'
import { AuthFooter } from '@components/Footers/LegalFooters'

interface AuthLayoutProps {
  org: any
  welcomeText?: string
  // No-org (apex) branding copy — platform-style title + subtitle.
  title?: string
  subtitle?: string
  children: React.ReactNode
}

export default function AuthLayout({ org, welcomeText, title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="vz-auth flex flex-col lg:flex-row relative">
      {/* Page-level blueprint grid, bottom-anchored */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.035) 1px, transparent 1px),
            linear-gradient(rgba(0,0,0,0.018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.018) 1px, transparent 1px)`,
          backgroundSize: '80px 80px, 80px 80px, 16px 16px, 16px 16px',
          maskImage: 'linear-gradient(to top, black 0%, transparent 60%)',
          WebkitMaskImage: 'linear-gradient(to top, black 0%, transparent 60%)',
        }}
      />

      {/* Left Panel - Content / form */}
      <div className="vz-auth-content relative z-10 flex flex-col flex-1 bg-transparent">
        <div className="pointer-events-none absolute inset-x-6 top-10 z-10 h-px bg-neutral-200 lg:hidden" />
        <div className="absolute left-1/2 top-2 z-20 -translate-x-1/2 lg:hidden">
          <AuthMobileHeader org={org} compact />
        </div>
        <div className="vz-auth-form-area flex-1 flex flex-col">{children}</div>
        {/* Terms footer (platform-style) */}
        <AuthFooter className="shrink-0" />
      </div>

      {/* Right Panel - Branding (hidden on mobile) */}
      <div className="vz-auth-art hidden lg:block w-[48%] relative z-10 shrink-0">
        <AuthBrandingPanel
          org={org}
          welcomeText={welcomeText}
          title={title}
          subtitle={subtitle}
        />
      </div>
    </div>
  )
}

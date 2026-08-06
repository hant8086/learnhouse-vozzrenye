import type { ReactNode } from 'react'

interface AuthSurfaceHeadingProps {
  eyebrow: string
  title: ReactNode
  description?: ReactNode
}

export default function AuthSurfaceHeading({
  eyebrow,
  title,
  description,
}: AuthSurfaceHeadingProps) {
  return (
    <header>
      <span className="mono-label">{eyebrow}</span>
      <h1 className="mt-3 text-[28px] font-black tracking-tight text-gray-900 leading-tight md:text-[32px]">
        {title}
      </h1>
      <div className="vz-hairline mt-4" />
      {description && (
        <p className="mt-3 text-[15px] font-medium text-gray-500">{description}</p>
      )}
    </header>
  )
}

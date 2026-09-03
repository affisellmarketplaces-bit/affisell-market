"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"

type Props = {
  href: string
  children: ReactNode
  className?: string
  prefetch?: boolean
}

/** Catalog link with intent-based route warmup (hover / touch) + default Link prefetch. */
export function CatalogCard({ href, children, className, prefetch = true }: Props) {
  const router = useRouter()

  const warmRoute = () => {
    try {
      router.prefetch(href)
    } catch {
      /* ignore */
    }
  }

  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={className}
      onMouseEnter={warmRoute}
      onTouchStart={warmRoute}
    >
      {children}
    </Link>
  )
}

"use client"

import type { ReactNode } from "react"

import { FastLink } from "@/components/navigation/fast-link"

export function FooterNavLink({
  href,
  children,
  className,
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  return (
    <FastLink href={href} className={className}>
      {children}
    </FastLink>
  )
}

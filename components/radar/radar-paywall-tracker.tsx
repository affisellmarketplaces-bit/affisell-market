"use client"

import { useEffect, type ReactNode } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { track } from "@/lib/analytics"
import type { RadarCockpit, SupplierKind } from "@/lib/supplier-kind"

type ViewProps = {
  supplierKind: SupplierKind
  cockpit: RadarCockpit | null
  needsOnboarding: boolean
  /** Distinguishes onboarding banner vs paid blur overlay */
  surface: "onboarding_banner" | "paid_blur"
}

/** Fire-and-forget once when paywall surface mounts. */
export function RadarPaywallViewTracker({
  supplierKind,
  cockpit,
  needsOnboarding,
  surface,
}: ViewProps) {
  useEffect(() => {
    track("radar_paywall_viewed", {
      supplierKind,
      cockpit,
      needsOnboarding,
      surface,
    })
  }, [supplierKind, cockpit, needsOnboarding, surface])

  return null
}

type CtaLinkProps = {
  href: string
  supplierKind: SupplierKind
  children: ReactNode
  className?: string
  surface: "onboarding_banner" | "paid_blur"
}

export function RadarPaywallCtaLink({
  href,
  supplierKind,
  children,
  className,
  surface,
}: CtaLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        track("radar_paywall_cta_clicked", { supplierKind, surface })
      }}
    >
      {children}
    </Link>
  )
}

type CtaButtonProps = {
  href: string
  supplierKind: SupplierKind
  children: ReactNode
  variant?: React.ComponentProps<typeof Button>["variant"]
  size?: React.ComponentProps<typeof Button>["size"]
  className?: string
  surface: "onboarding_banner" | "paid_blur"
}

export function RadarPaywallCtaButton({
  href,
  supplierKind,
  children,
  variant = "bentoAccent",
  size = "lg",
  className,
  surface,
}: CtaButtonProps) {
  return (
    <Button asChild variant={variant} size={size} className={className}>
      <RadarPaywallCtaLink href={href} supplierKind={supplierKind} surface={surface}>
        {children}
      </RadarPaywallCtaLink>
    </Button>
  )
}

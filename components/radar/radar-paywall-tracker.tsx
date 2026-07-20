"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { track } from "@/lib/analytics"
import type { RadarCheckoutPlanId } from "@/lib/radar/plans"
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

type CheckoutButtonProps = {
  plan: RadarCheckoutPlanId
  supplierKind: SupplierKind
  children: ReactNode
  returnPath?: string
  variant?: React.ComponentProps<typeof Button>["variant"]
  size?: React.ComponentProps<typeof Button>["size"]
  className?: string
  surface: "onboarding_banner" | "paid_blur"
}

/** Stripe Radar checkout — unlocks `User.radarPlan` via webhook + verify-radar. */
export function RadarPaywallCheckoutButton({
  plan,
  supplierKind,
  children,
  returnPath = "/radar",
  variant = "bentoAccent",
  size = "lg",
  className,
  surface,
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false)

  async function startCheckout() {
    track("radar_paywall_cta_clicked", { supplierKind, surface, plan })
    setLoading(true)
    try {
      const res = await fetch("/api/stripe/create-radar-checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, returnPath }),
      })
      const data = (await res.json()) as { url?: string; error?: string; message?: string }
      if (res.status === 503 && data.error?.includes("NOT_CONFIGURED")) {
        toast.error("Paiement Radar indisponible — contacte le support Affisell")
        setLoading(false)
        return
      }
      if (!res.ok || !data.url) {
        throw new Error(data.message ?? data.error ?? "Impossible de démarrer le paiement")
      }
      window.location.href = data.url
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec du checkout Radar")
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={loading}
      onClick={() => void startCheckout()}
    >
      {loading ? "Redirection…" : children}
    </Button>
  )
}

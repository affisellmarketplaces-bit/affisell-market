"use client"

import { SupplierTrustBadge } from "@/components/suppliers/supplier-trust-badge"

type VerifiedBadgeProps = {
  className?: string
  tier?: string | null
}

/** @deprecated Prefer `SupplierTrustBadge` with explicit `tier`. */
export function VerifiedBadge({ className, tier }: VerifiedBadgeProps) {
  return (
    <SupplierTrustBadge
      className={className}
      tier={tier ?? undefined}
      isVerifiedSupplier={!tier}
    />
  )
}

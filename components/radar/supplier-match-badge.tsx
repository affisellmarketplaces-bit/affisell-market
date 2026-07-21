import Link from "next/link"

import { getRadarCopyForRole } from "@/lib/radar/radar-copy"
import type { SupplierMatchDto } from "@/lib/radar/world-radar-types"
import { cn } from "@/lib/utils"

type Props = {
  match: SupplierMatchDto | null | undefined
  className?: string
  userRole?: string | null
  country?: string
}

/**
 * Supplier Match badge — affiliate = no-stock · supplier = grossiste opportunity.
 */
export function SupplierMatchBadge({ match, className, userRole, country = "FR" }: Props) {
  if (!match) return null

  const copy = getRadarCopyForRole(
    userRole,
    { supplierCount: match.count },
    country
  )

  const href =
    userRole === "SUPPLIER"
      ? match.count > 0
        ? "/dashboard/supplier/products/new?from=radar&mode=supplier"
        : "/dashboard/supplier/onboarding/kind"
      : "/dashboard/affiliate/catalog"

  const label = match.count > 0 ? copy.supplierLabel : copy.opportunityLabel
  const isSupplierEmpty = userRole === "SUPPLIER" && match.count === 0

  return (
    <Link
      href={href}
      title={copy.tooltip}
      className={cn(
        "mt-1.5 inline-flex max-w-full items-center rounded-lg border px-2 py-1 text-[10px] font-semibold leading-snug hover:opacity-90",
        isSupplierEmpty || match.count === 0
          ? "border-violet-200 bg-violet-50 text-violet-800"
          : userRole === "SUPPLIER"
            ? "border-amber-200 bg-amber-50 text-amber-900"
            : "border-emerald-200 bg-emerald-50 text-emerald-800",
        className
      )}
    >
      {label}
    </Link>
  )
}

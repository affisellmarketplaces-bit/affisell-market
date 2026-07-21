import Link from "next/link"

import {
  radarSupplierMatchEmptyCopy,
  radarSupplierMatchPositiveCopy,
} from "@/lib/radar/radar-copy"
import type { SupplierMatchDto } from "@/lib/radar/world-radar-types"
import { cn } from "@/lib/utils"

type Props = {
  match: SupplierMatchDto | null | undefined
  className?: string
  /** AFFILIATE → catalogue; SUPPLIER → onboarding/new product */
  userRole?: string | null
}

/**
 * Supplier Match Instantané — flywheel badge (Affisell catalogue ↔ Radar demand).
 * Copy is no-stock / reseller-first (no “Grossiste”).
 */
export function SupplierMatchBadge({ match, className, userRole }: Props) {
  if (!match) return null

  const href =
    userRole === "AFFILIATE"
      ? "/dashboard/affiliate/catalog"
      : match.count > 0
        ? "/dashboard/supplier/products/new"
        : "/dashboard/supplier/onboarding/kind"

  if (match.count > 0) {
    return (
      <Link
        href={href}
        className={cn(
          "mt-1.5 inline-flex max-w-full items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold leading-snug text-emerald-800 hover:bg-emerald-100",
          className
        )}
      >
        {radarSupplierMatchPositiveCopy(match.count)}
      </Link>
    )
  }

  return (
    <Link
      href={href}
      className={cn(
        "mt-1.5 inline-flex max-w-full items-center rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-semibold leading-snug text-violet-800 hover:bg-violet-100",
        className
      )}
    >
      {radarSupplierMatchEmptyCopy()}
    </Link>
  )
}

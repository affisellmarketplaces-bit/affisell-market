import Link from "next/link"

import type { SupplierMatchDto } from "@/lib/radar/world-radar-types"
import { cn } from "@/lib/utils"

type Props = {
  match: SupplierMatchDto | null | undefined
  className?: string
}

/**
 * Supplier Match Instantané — flywheel badge (Affisell catalogue ↔ Radar demand).
 */
export function SupplierMatchBadge({ match, className }: Props) {
  if (!match) return null

  if (match.count > 0) {
    return (
      <Link
        href="/dashboard/supplier/products/new"
        className={cn(
          "mt-1.5 inline-flex max-w-full items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold leading-snug text-emerald-800 hover:bg-emerald-100",
          className
        )}
      >
        ✅ {match.count} Fournisseur{match.count > 1 ? "s" : ""} FR en stock — Sourcer en 1 clic →
      </Link>
    )
  }

  return (
    <Link
      href="/dashboard/supplier/onboarding/kind"
      className={cn(
        "mt-1.5 inline-flex max-w-full items-center rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-semibold leading-snug text-violet-800 hover:bg-violet-100",
        className
      )}
    >
      💜 Aucun fournisseur FR — Opportunité Grossiste — Devenir le seul →
    </Link>
  )
}

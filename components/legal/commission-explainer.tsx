"use client"

import {
  buildOrderCommissionBreakdown,
  formatBreakdownAmount,
  type OrderCommissionRow,
} from "@/lib/order-commission-breakdown"
import { cn } from "@/lib/utils"

type Role = "SUPPLIER" | "AFFILIATE" | "CUSTOMER"

type OrderSnapshot = {
  basePriceCents: number
  supplierPriceCents?: number | null
  sellingPriceCents: number
  subtotalCents?: number | null
  taxCents?: number | null
  totalCents?: number | null
  affiliatePayoutCents: number
  affiliateMarginRetainedCents: number
  affiliateFeeCents?: number | null
  affisellFeeCents: number
  supplierPayoutCents?: number | null
  marginCents: number
}

type Props = {
  role: Role
  order: OrderSnapshot
  /** Supplier store setting — hide supplier net from affiliates when false. */
  showRevenueToAffiliate?: boolean
  className?: string
}

function filterRowsForRole(
  rows: OrderCommissionRow[],
  role: Role,
  showRevenueToAffiliate: boolean
): OrderCommissionRow[] {
  return rows
    .map((row) => {
      if (role === "SUPPLIER") {
      if (row.label === "Markup affilié" || row.label === "Gain affilié net") {
        return { ...row, hidden: true }
      }
      }
      if (role === "AFFILIATE") {
        if (row.label === "Net fournisseur" && !showRevenueToAffiliate) {
          return { ...row, hidden: true }
        }
        if (row.label === "Catalogue fournisseur (HT)" && !showRevenueToAffiliate) {
          return { ...row, hidden: true }
        }
        if (row.label === "Frais plateforme Affisell (total commande)") {
          return { ...row, hidden: true }
        }
      }
      if (role === "CUSTOMER") {
        if (
          row.label === "Catalogue fournisseur (HT)" ||
          row.label === "Commission partenaire" ||
          row.label === "Markup affilié" ||
          row.label === "Net fournisseur" ||
          row.label === "Gain affilié net" ||
          row.label === "Frais plateforme Affisell (affilié)" ||
          row.label === "Frais plateforme Affisell (total commande)"
        ) {
          return { ...row, hidden: true }
        }
      }
      return row
    })
    .filter((r) => !r.hidden)
}

export function CommissionExplainer({ role, order, showRevenueToAffiliate = false, className }: Props) {
  const breakdown = buildOrderCommissionBreakdown(order)
  const rows = filterRowsForRole(breakdown.rows, role, showRevenueToAffiliate)

  const headline =
    role === "SUPPLIER"
      ? `Votre versement : ${formatBreakdownAmount(breakdown.supplierNetCents)}`
      : role === "AFFILIATE"
        ? `Vos gains : ${formatBreakdownAmount(breakdown.affiliateTotalCents)}`
        : `Total payé : ${formatBreakdownAmount(breakdown.clientTtcCents)}`

  return (
    <section
      className={cn(
        "rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/50",
        className
      )}
      aria-label="Répartition des montants"
    >
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">{headline}</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Montants HT sauf mention TTC · fee affilié = % de vos gains (commission + markup)
      </p>
      <table className="mt-4 w-full text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-zinc-200/80 last:border-0 dark:border-zinc-800">
              <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">
                {row.label}
                {row.hint ? (
                  <span className="mt-0.5 block text-[11px] text-zinc-400 dark:text-zinc-500">{row.hint}</span>
                ) : null}
              </td>
              <td className="py-2 text-right font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                {formatBreakdownAmount(row.amountCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

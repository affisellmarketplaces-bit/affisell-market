import Link from "next/link"
import { redirect } from "next/navigation"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { requireAffiliateSession } from "@/lib/dashboard-session"
import {
  CLAWBACK_RISK_RETURN_STATUSES,
  CLAWBACK_RISK_WINDOW_DAYS,
  loadAffiliateRefundHistory,
} from "@/lib/affiliate-clawback-risk"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"

export const dynamic = "force-dynamic"

const STATUS_LABELS: Record<string, string> = {
  REQUESTED: "Demandé",
  AWAITING_SHIPMENT: "En attente d'expédition",
  IN_TRANSIT: "Colis en transit",
  RECEIVED: "Reçu — remboursement en cours",
  REFUNDED: "Remboursé",
  REJECTED: "Refusé",
  CANCELLED: "Annulé",
}

export default async function AffiliateRefundsHistoryPage() {
  const session = await requireAffiliateSession("/dashboard/refunds")
  if (session.user.role !== "AFFILIATE") {
    redirect("/dashboard/supplier/returns")
  }

  const rows = await loadAffiliateRefundHistory(session.user.id)

  return (
    <BentoShell>
      <BentoContainer maxWidth="5xl" className="space-y-6 py-10">
        <BentoPageHeading
          eyebrow="Clawback & retours"
          title="Historique des remboursements"
          description={`Retours des ${CLAWBACK_RISK_WINDOW_DAYS} derniers jours liés à vos ventes affiliées.`}
        />

        <BentoCard className="overflow-hidden p-0">
          {rows.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-zinc-600 dark:text-zinc-400">
              Aucun retour sur la période.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/80 text-xs uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <th className="px-4 py-3 font-semibold">Produit</th>
                    <th className="px-4 py-3 font-semibold">Statut</th>
                    <th className="px-4 py-3 font-semibold">Commission à risque</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isPending = CLAWBACK_RISK_RETURN_STATUSES.includes(
                      row.status as (typeof CLAWBACK_RISK_RETURN_STATUSES)[number]
                    )
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/80"
                      >
                        <td className="px-4 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                          {row.productName}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={
                              isPending
                                ? "font-medium text-amber-800 dark:text-amber-200"
                                : "text-zinc-600 dark:text-zinc-400"
                            }
                          >
                            {STATUS_LABELS[row.status] ?? row.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 tabular-nums text-zinc-700 dark:text-zinc-300">
                          {formatStoreCurrencyFromCents(row.commissionAtRiskCents)}
                        </td>
                        <td className="px-4 py-4 tabular-nums text-zinc-600 dark:text-zinc-400">
                          {row.createdAt.toLocaleDateString("fr-FR")}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </BentoCard>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <Link
            href="/dashboard/affiliate"
            className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
          >
            ← Retour au dashboard
          </Link>
        </p>
      </BentoContainer>
    </BentoShell>
  )
}

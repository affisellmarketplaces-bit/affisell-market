"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { DeliveryBadge } from "@/components/logistics/DeliveryBadge"
import { DeliveryReviewModal } from "@/components/logistics/DeliveryReviewModal"
import { SupplierTrustBadge } from "@/components/logistics/SupplierTrustBadge"
import { useSupplierMetricsMap } from "@/components/logistics/SupplierTrustSelfCard"
import { AFFILIATE_CATALOG_PATH } from "@/lib/affiliate-routes"
import { getDeliveryScore } from "@/lib/logistics/delivery-sla"
import { quoteVisibilityRank } from "@/lib/logistics/supplier-score"
import type { ProductQuoteDto } from "@/lib/product-request-types"

export function ResellerQuotesComparator({
  requestId,
  requestStatus,
  requestCountry,
  quotes,
  winningListingId,
  alreadyReviewedQuoteId,
}: {
  requestId: string
  requestStatus: string
  requestCountry: string
  quotes: ProductQuoteDto[]
  winningListingId: string | null
  alreadyReviewedQuoteId?: string | null
}) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const confettiFired = useRef(false)
  const [reviewOpen, setReviewOpen] = useState(false)

  const supplierIds = useMemo(
    () => [...new Set(quotes.map((q) => q.supplierId))],
    [quotes]
  )
  const metricsMap = useSupplierMetricsMap(supplierIds)

  const sortedQuotes = useMemo(() => {
    return [...quotes].sort((a, b) => {
      const ta = metricsMap[a.supplierId]?.trustScore ?? 75
      const tb = metricsMap[b.supplierId]?.trustScore ?? 75
      const ra = quoteVisibilityRank({
        trustScore: ta,
        deliveryDays: a.deliveryDays,
        country: requestCountry,
        getDeliveryScore,
      })
      const rb = quoteVisibilityRank({
        trustScore: tb,
        deliveryDays: b.deliveryDays,
        country: requestCountry,
        getDeliveryScore,
      })
      if (rb !== ra) return rb - ra
      return a.price - b.price
    })
  }, [quotes, metricsMap, requestCountry])

  async function accept(quoteId: string) {
    setPendingId(quoteId)
    try {
      const res = await fetch(`/api/requests/${requestId}/quotes/${quoteId}/accept`, {
        method: "POST",
        credentials: "same-origin",
      })
      const json = (await res.json().catch(() => ({}))) as {
        error?: string
        affiliateProductId?: string | null
      }
      if (!res.ok) {
        toast.error(json.error ?? "Acceptation impossible")
        return
      }

      if (!confettiFired.current) {
        confettiFired.current = true
        void import("canvas-confetti").then(({ default: confetti }) => {
          confetti({ particleCount: 90, spread: 70, origin: { y: 0.65 } })
        })
      }

      toast.success("Devis accepté — draft catalogue créé")
      const listingId = json.affiliateProductId
      if (listingId) {
        router.push(`${AFFILIATE_CATALOG_PATH}?editListing=${encodeURIComponent(listingId)}`)
      } else {
        router.refresh()
      }
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setPendingId(null)
    }
  }

  const accepted = sortedQuotes.find((q) => q.status === "accepted") ?? null
  const fulfilled = requestStatus === "fulfilled" || requestStatus === "closed"
  const canReview = Boolean(fulfilled && accepted && !alreadyReviewedQuoteId)

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-zinc-900">
          Devis reçus ({sortedQuotes.length})
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {canReview ? (
            <button
              type="button"
              onClick={() => setReviewOpen(true)}
              className="text-xs font-semibold text-orange-700 hover:underline"
            >
              Noter la livraison →
            </button>
          ) : null}
          {fulfilled && winningListingId ? (
            <Link
              href={`${AFFILIATE_CATALOG_PATH}?editListing=${encodeURIComponent(winningListingId)}`}
              className="text-xs font-semibold text-violet-700 hover:underline"
            >
              Voir produit dans catalogue →
            </Link>
          ) : null}
        </div>
      </div>

      {fulfilled && accepted ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <span>
            Gagnant:{" "}
            <strong>{accepted.supplierName || accepted.supplierEmail || "Fournisseur"}</strong> —{" "}
            {accepted.price}€ · MOQ {accepted.moq}
          </span>
          <DeliveryBadge days={accepted.deliveryDays} country={requestCountry} variant="full" />
          <SupplierTrustBadge
            trustScore={metricsMap[accepted.supplierId]?.trustScore ?? 75}
            totalOrders={metricsMap[accepted.supplierId]?.totalOrders}
            onTimeDeliveries={metricsMap[accepted.supplierId]?.onTimeDeliveries}
            promisedVsActualDelta={metricsMap[accepted.supplierId]?.promisedVsActualDelta}
          />
        </div>
      ) : null}

      {sortedQuotes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-600">
          Aucun devis pour l’instant — les fournisseurs sont notifiés.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Fournisseur</th>
                <th className="px-3 py-2 font-semibold">Prix</th>
                <th className="px-3 py-2 font-semibold">MOQ</th>
                <th className="px-3 py-2 font-semibold">Délai</th>
                <th className="px-3 py-2 font-semibold">Trust</th>
                <th className="px-3 py-2 font-semibold">Message</th>
                <th className="px-3 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedQuotes.map((q) => {
                const m = metricsMap[q.supplierId]
                const trust = m?.trustScore ?? 75
                const dimmed = trust < 40
                const top = trust >= 90
                return (
                  <tr
                    key={q.id}
                    className={`border-b border-zinc-50 last:border-0 ${
                      dimmed ? "opacity-50" : top ? "bg-amber-50/40" : ""
                    }`}
                  >
                    <td className="px-3 py-3 font-medium text-zinc-900">
                      {q.supplierName || q.supplierEmail || "Fournisseur"}
                      {q.status !== "pending" ? (
                        <span className="ml-2 text-[10px] uppercase text-zinc-400">
                          {q.status}
                        </span>
                      ) : null}
                      {top ? (
                        <span className="ml-2 text-[10px] font-bold text-amber-700">
                          Boost +30%
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 font-semibold">{q.price}€</td>
                    <td className="px-3 py-3">{q.moq}</td>
                    <td className="px-3 py-3">
                      <DeliveryBadge days={q.deliveryDays} country={requestCountry} variant="full" />
                    </td>
                    <td className="px-3 py-3">
                      <SupplierTrustBadge
                        trustScore={trust}
                        totalOrders={m?.totalOrders}
                        onTimeDeliveries={m?.onTimeDeliveries}
                        promisedVsActualDelta={m?.promisedVsActualDelta}
                      />
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-3 text-xs text-zinc-600">
                      {q.message || "—"}
                    </td>
                    <td className="px-3 py-3">
                      {!fulfilled && q.status === "pending" ? (
                        <button
                          type="button"
                          disabled={pendingId != null}
                          onClick={() => void accept(q.id)}
                          className="rounded-lg bg-[#6D28D9] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5B21B6] disabled:opacity-60"
                        >
                          {pendingId === q.id ? "…" : "Accepter"}
                        </button>
                      ) : q.status === "accepted" ? (
                        <span className="text-xs font-bold text-emerald-700">Accepté</span>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {accepted ? (
        <DeliveryReviewModal
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          supplierId={accepted.supplierId}
          requestId={requestId}
          quoteId={accepted.id}
          promisedDays={accepted.deliveryDays}
          supplierName={accepted.supplierName}
          onSubmitted={() => router.refresh()}
        />
      ) : null}
    </section>
  )
}

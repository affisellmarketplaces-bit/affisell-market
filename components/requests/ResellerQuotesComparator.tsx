"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { toast } from "sonner"

import { AFFILIATE_CATALOG_PATH } from "@/lib/affiliate-routes"
import type { ProductQuoteDto } from "@/lib/product-request-types"

export function ResellerQuotesComparator({
  requestId,
  requestStatus,
  quotes,
  winningListingId,
}: {
  requestId: string
  requestStatus: string
  quotes: ProductQuoteDto[]
  winningListingId: string | null
}) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const confettiFired = useRef(false)

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

  const accepted = quotes.find((q) => q.status === "accepted") ?? null
  const fulfilled = requestStatus === "fulfilled" || requestStatus === "closed"

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-zinc-900">
          Devis reçus ({quotes.length})
        </h2>
        {fulfilled && winningListingId ? (
          <Link
            href={`${AFFILIATE_CATALOG_PATH}?editListing=${encodeURIComponent(winningListingId)}`}
            className="text-xs font-semibold text-violet-700 hover:underline"
          >
            Voir produit dans catalogue →
          </Link>
        ) : null}
      </div>

      {fulfilled && accepted ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Gagnant:{" "}
          <strong>{accepted.supplierName || accepted.supplierEmail || "Fournisseur"}</strong> —{" "}
          {accepted.price}€ · MOQ {accepted.moq} · {accepted.deliveryDays}j
        </div>
      ) : null}

      {quotes.length === 0 ? (
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
                <th className="px-3 py-2 font-semibold">Message</th>
                <th className="px-3 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id} className="border-b border-zinc-50 last:border-0">
                  <td className="px-3 py-3 font-medium text-zinc-900">
                    {q.supplierName || q.supplierEmail || "Fournisseur"}
                    {q.status !== "pending" ? (
                      <span className="ml-2 text-[10px] uppercase text-zinc-400">{q.status}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 font-semibold">{q.price}€</td>
                  <td className="px-3 py-3">{q.moq}</td>
                  <td className="px-3 py-3">{q.deliveryDays}j</td>
                  <td className="max-w-[220px] truncate px-3 py-3 text-xs text-zinc-600">
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

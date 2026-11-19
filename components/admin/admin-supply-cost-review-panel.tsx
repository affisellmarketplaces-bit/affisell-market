"use client"

import { useCallback, useEffect, useState } from "react"

type Qualification = "unverified" | "document_provided" | "verified" | "disputed" | "expired"
type Review = {
  current: { unitCostCents: number; deliveryCostCents: number; source: string; declaredAt: string; note: string } | null
  currentN: number | null
  qualification: Qualification
  qualificationEvents: Array<{ state: Qualification; note: string; at: string; role: string }>
  history: Array<{ n: number; unitCostCents: number; deliveryCostCents: number; declaredAt: string; qualification: Qualification }>
  supplierPriceCents: number
  observed: {
    pairs: Array<{ orderId: string; paidAt: string; observedUnitCents: number; declaredUnitCents: number | null; gapCents: number | null }>
    comparable: number
    withoutDeclaration: number
    medianGapCents: number | null
    caveat: string
  }
  observedTruncated: boolean
}

const Q_LABEL: Record<Qualification, string> = {
  unverified: "Non vérifiée",
  document_provided: "Justificatif annoncé par le fournisseur (non vérifié)",
  verified: "Vérifiée par Affisell",
  disputed: "Contestée",
  expired: "Expirée",
}
const eur = (c: number | null | undefined) => (c == null ? "—" : `${(c / 100).toFixed(2).replace(".", ",")} €`)

/** Admin: the supplier's DECLARED supply costs, their qualification (by a person) and the comparison with recorded costs. */
export function AdminSupplyCostReviewPanel({ productId }: { productId: string }) {
  const [review, setReview] = useState<Review | null>(null)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const url = `/api/admin/products/${encodeURIComponent(productId)}/supply-cost`

  const load = useCallback(async () => {
    const res = await fetch(url, { cache: "no-store" })
    if (res.ok) setReview((await res.json()) as Review)
  }, [url])
  useEffect(() => {
    void load()
  }, [load])

  const qualify = async (state: "verified" | "disputed" | "expired") => {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ state, note }) })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      setMsg(res.ok ? `Statut enregistré : ${Q_LABEL[state]}.` : `Refusé : ${json.error ?? res.status}`)
      if (res.ok) setNote("")
      await load()
    } finally {
      setBusy(false)
    }
  }

  if (!review) return null
  return (
    <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Coûts déclarés par le fournisseur (confidentiel)</h2>
      {!review.current ? (
        <p className="text-sm text-zinc-500">Aucune déclaration.</p>
      ) : (
        <>
          <p className="text-sm">
            Déclaration n° {review.currentN} du {new Date(review.current.declaredAt).toLocaleDateString("fr-FR")} : coût unitaire{" "}
            {eur(review.current.unitCostCents)}, livraison {eur(review.current.deliveryCostCents)} — prix fournisseur{" "}
            {eur(review.supplierPriceCents)}.
          </p>
          <p className="text-sm">
            Statut : <span className="font-medium">{Q_LABEL[review.qualification]}</span>
          </p>
          <p className="text-xs text-zinc-500">
            Un coût non vérifié ne sert qu&apos;aux simulations internes, avec un avertissement. Aucun taux, engagement ou
            automatisme ne peut reposer sur une déclaration seule.
          </p>
          <textarea
            className="w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
            rows={2}
            placeholder="Motif (obligatoire) : document contrôlé, écart constaté, date de validité…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {(["verified", "disputed", "expired"] as const).map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy || note.trim().length < 3}
                onClick={() => void qualify(s)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-zinc-700"
              >
                {s === "verified" ? "Marquer vérifiée" : s === "disputed" ? "Contester" : "Marquer expirée"}
              </button>
            ))}
          </div>
          {msg ? <p className="text-sm">{msg}</p> : null}
        </>
      )}
      <div className="space-y-1 border-t border-zinc-200 pt-3 text-sm dark:border-zinc-800">
        <p className="font-medium">Déclaré ou constaté (jamais fusionnés)</p>
        <p className="text-xs text-zinc-500">{review.observed.caveat}</p>
        <p>
          {review.observed.comparable} commande(s) comparable(s)
          {review.observed.withoutDeclaration > 0 ? `, ${review.observed.withoutDeclaration} sans déclaration en vigueur` : ""}
          {review.observedTruncated ? " (lecture tronquée)" : ""}.{" "}
          {review.observed.medianGapCents == null
            ? "Écart médian : trop peu de commandes pour conclure."
            : `Écart médian (constaté − déclaré, par unité) : ${eur(review.observed.medianGapCents)}.`}
        </p>
      </div>
      {review.history.length > 1 ? (
        <ol className="space-y-1 border-t border-zinc-200 pt-3 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          {review.history.map((h) => (
            <li key={h.n}>
              n° {h.n} · {new Date(h.declaredAt).toLocaleDateString("fr-FR")} · {eur(h.unitCostCents)} + {eur(h.deliveryCostCents)} ·{" "}
              {Q_LABEL[h.qualification]}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  )
}

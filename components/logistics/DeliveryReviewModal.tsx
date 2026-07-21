"use client"

import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"

type Props = {
  open: boolean
  onClose: () => void
  supplierId: string
  requestId: string
  quoteId: string
  promisedDays: number
  supplierName?: string | null
  onSubmitted?: () => void
}

/** Post-fulfillment delivery rating modal. */
export function DeliveryReviewModal({
  open,
  onClose,
  supplierId,
  requestId,
  quoteId,
  promisedDays,
  supplierName,
  onSubmitted,
}: Props) {
  const [rating, setRating] = useState(5)
  const [actualDays, setActualDays] = useState(String(promisedDays))
  const [comment, setComment] = useState("")
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (open) {
      setRating(5)
      setActualDays(String(promisedDays))
      setComment("")
    }
  }, [open, promisedDays])

  if (!open) return null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const actual = Number(actualDays)
    if (!Number.isFinite(actual) || actual < 0) {
      toast.error("Jours livrés invalides")
      return
    }
    setPending(true)
    try {
      const res = await fetch("/api/reviews/delivery", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          requestId,
          quoteId,
          promisedDays,
          actualDays: actual,
          rating,
          comment: comment.trim() || null,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(
          json.error === "already_reviewed" ? "Déjà noté" : "Échec notation"
        )
        return
      }
      toast.success("Merci — Trust Score fournisseur mis à jour")
      onSubmitted?.()
      onClose()
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal
        className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl"
      >
        <h2 className="text-base font-bold text-zinc-900">
          Comment s&apos;est passée la livraison?
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          {supplierName ? `${supplierName} — ` : ""}Promis: {promisedDays}j
        </p>

        <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-zinc-700">Note</p>
            <div className="mt-1 flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={`size-9 rounded-lg text-lg ${
                    n <= rating ? "bg-amber-100 text-amber-700" : "bg-zinc-50 text-zinc-300"
                  }`}
                  aria-label={`${n} étoiles`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <label className="block text-xs font-semibold text-zinc-700">
            Livré en (jours)
            <input
              type="number"
              min={0}
              required
              value={actualDays}
              onChange={(e) => setActualDays(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-xs font-semibold text-zinc-700">
            Commentaire (optionnel)
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700"
            >
              Plus tard
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-xl bg-[#6D28D9] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? "…" : "Noter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { toast } from "sonner"

import type { ProductQuoteDto } from "@/lib/product-request-types"

export function SupplierQuoteForm({
  requestId,
  existingQuote,
}: {
  requestId: string
  existingQuote: ProductQuoteDto | null
}) {
  const router = useRouter()
  const [price, setPrice] = useState("")
  const [moq, setMoq] = useState("50")
  const [deliveryDays, setDeliveryDays] = useState("7")
  const [message, setMessage] = useState("")
  const [pending, setPending] = useState(false)

  if (existingQuote) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-zinc-900">Ton devis</h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
              existingQuote.status === "accepted"
                ? "bg-emerald-50 text-emerald-700"
                : existingQuote.status === "rejected"
                  ? "bg-zinc-100 text-zinc-500"
                  : "bg-amber-50 text-amber-800"
            }`}
          >
            {existingQuote.status}
          </span>
        </div>
        <dl className="mt-3 grid gap-2 text-sm text-zinc-700 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-zinc-500">Prix</dt>
            <dd className="font-semibold">{existingQuote.price}€</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">MOQ</dt>
            <dd className="font-semibold">{existingQuote.moq}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Délai</dt>
            <dd className="font-semibold">{existingQuote.deliveryDays}j</dd>
          </div>
        </dl>
        {existingQuote.message ? (
          <p className="mt-3 text-xs text-zinc-600 whitespace-pre-wrap">{existingQuote.message}</p>
        ) : null}
      </div>
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const priceN = Number(price)
    const moqN = Number(moq)
    const daysN = Number(deliveryDays)
    if (!Number.isFinite(priceN) || priceN <= 0) {
      toast.error("Prix unitaire requis")
      return
    }
    if (!Number.isFinite(moqN) || moqN < 1) {
      toast.error("MOQ requis")
      return
    }
    if (!Number.isFinite(daysN) || daysN < 1) {
      toast.error("Délai requis")
      return
    }

    setPending(true)
    try {
      const res = await fetch(`/api/requests/${requestId}/quotes`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price: priceN,
          moq: moqN,
          deliveryDays: daysN,
          message: message.trim() || undefined,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(json.error === "already_quoted" ? "Tu as déjà quoté" : "Échec envoi devis")
        return
      }
      toast.success("Devis envoyé — le reseller est notifié")
      router.refresh()
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-orange-200 bg-orange-50/60 p-4">
      <h2 className="text-sm font-bold text-orange-950">Faire un devis</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs font-medium text-zinc-700">
          Prix unitaire (€)*
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-zinc-700">
          MOQ*
          <input
            type="number"
            min="1"
            required
            value={moq}
            onChange={(e) => setMoq(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-zinc-700">
          Délai (jours)*
          <input
            type="number"
            min="1"
            required
            value={deliveryDays}
            onChange={(e) => setDeliveryDays(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
          />
        </label>
      </div>
      <label className="block text-xs font-medium text-zinc-700">
        Message
        <textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Stock EU, envoi 48h…"
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-xl bg-[#6D28D9] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#5B21B6] disabled:opacity-60"
      >
        {pending ? "Envoi…" : "Envoyer mon devis →"}
      </button>
      <Link href="/dashboard/supplier/requests" className="block text-center text-xs text-zinc-500 hover:underline">
        ← Retour aux demandes
      </Link>
    </form>
  )
}

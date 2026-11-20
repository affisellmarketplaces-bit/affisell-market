"use client"

import { useCallback, useEffect, useState } from "react"

import type { SuspensionReason } from "@/lib/products/affisell-suspension"

type View = {
  active: boolean
  cause: "on_sale" | "held_by_affisell" | "paused_by_supplier"
  holds: Array<"product_recalled" | "product_suspended">
  suspension: { state: "suspended" | "lifted"; reason: SuspensionReason | null; note: string; at: string | null } | null
  history: Array<{ n: number; state: "suspended" | "lifted"; reason: SuspensionReason | null; note: string; at: string | null }>
}

const REASONS: Array<[SuspensionReason, string]> = [
  ["product_safety", "Sécurité du produit"],
  ["legal_or_ip", "Juridique / propriété intellectuelle"],
  ["listing_quality", "Qualité de la fiche"],
  ["fraud_or_abuse", "Fraude ou abus"],
  ["supplier_account", "Compte fournisseur"],
  ["other", "Autre"],
]
const REASON_LABEL = Object.fromEntries(REASONS) as Record<string, string>
const CAUSE: Record<View["cause"], string> = {
  on_sale: "En vente",
  held_by_affisell: "Retiré de la vente par Affisell",
  paused_by_supplier: "Hors vente (pause ou brouillon côté fournisseur)",
}

/** Admin: Affisell suspension, kept apart from the supplier's pause (lib/products/affisell-suspension.ts). */
export function AdminProductSuspensionPanel({ productId }: { productId: string }) {
  const [view, setView] = useState<View | null>(null)
  const [reason, setReason] = useState<SuspensionReason>("product_safety")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/products/${encodeURIComponent(productId)}/suspension`, { cache: "no-store" })
    if (res.ok) setView((await res.json()) as View)
  }, [productId])
  useEffect(() => {
    void load()
  }, [load])

  const act = async (action: "suspend" | "lift") => {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(productId)}/suspension`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, reason, note }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string; recallStillOpen?: boolean }
      if (!res.ok) setMessage(`Refusé : ${json.error ?? res.status}`)
      else if (action === "lift")
        setMessage(
          json.recallStillOpen
            ? "Suspension levée. Un rappel de sécurité reste ouvert : le produit reste bloqué."
            : "Suspension levée. Le produit reste hors vente tant que le fournisseur ne le remet pas en vente."
        )
      else setMessage("Produit suspendu et retiré de la vente.")
      setNote("")
      await load()
    } finally {
      setBusy(false)
    }
  }

  if (!view) return null
  const suspended = view.suspension?.state === "suspended"
  return (
    <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Statut commercial</h2>
      <p className="text-sm">
        <span className="font-medium">{CAUSE[view.cause]}</span>
        {view.holds.includes("product_recalled") ? " · rappel de sécurité ouvert" : ""}
        {suspended && view.suspension?.reason ? ` · suspendu : ${REASON_LABEL[view.suspension.reason]}` : ""}
      </p>
      <p className="text-xs text-zinc-500">
        La suspension est une décision d&apos;Affisell : le fournisseur ne peut pas remettre le produit en vente tant
        qu&apos;elle dure. La lever ne remet pas le produit en vente, le fournisseur en décide.
      </p>
      {!suspended ? (
        <select
          className="w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
          value={reason}
          onChange={(e) => setReason(e.target.value as SuspensionReason)}
        >
          {REASONS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      ) : null}
      <textarea
        className="w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
        rows={2}
        placeholder="Motif détaillé (obligatoire, conservé dans l'historique)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button
        type="button"
        disabled={busy || note.trim().length < 3}
        onClick={() => void act(suspended ? "lift" : "suspend")}
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {suspended ? "Lever la suspension" : "Suspendre la vente"}
      </button>
      {message ? <p className="text-sm text-zinc-700 dark:text-zinc-300">{message}</p> : null}
      {view.history.length > 0 ? (
        <ol className="space-y-1 border-t border-zinc-200 pt-3 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          {view.history.map((h) => (
            <li key={h.n}>
              {h.at ? new Date(h.at).toLocaleString("fr-FR") : "—"} ·{" "}
              {h.state === "suspended" ? `suspendu (${h.reason ? REASON_LABEL[h.reason] : "?"})` : "levé"} · {h.note}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  )
}

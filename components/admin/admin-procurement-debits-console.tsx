"use client"

import { useCallback, useEffect, useState } from "react"

type Allocation = { id: string; orderId: string; amountCents: number; status: string; basis: string; note: string; createdAt: string; revokeReason: string | null }
type Movement = {
  id: string
  kind: "debit" | "refund" | "refund_reversal" | "fee"
  state: "voided" | "needs_review" | "unallocated" | "partially_allocated" | "fully_allocated" | "not_allocatable"
  amountOrigin: "read_from_source" | "typed_from_document"
  reviewReason: string | null
  issuingCardId: string | null
  balanceTransactionId: string | null
  source: string
  sourceReference: string
  status: "recorded" | "voided"
  amountCents: number
  currency: string
  settledAmountCents: number | null
  parentDebitId: string | null
  occurredAt: string
  note: string
  voidReason: string | null
  balance: { allocatedCents: number; remainingCents: number; overAllocated: boolean }
  allocations: Allocation[]
}
type Reconciliation = {
  status: "not_reconciled" | "incomplete" | "reconciled"
  storedSourcePriceCents: number | null
  debitedCents: number
  refundedCents: number
  feesCents: number
  netDebitedCents: number
  fullCostCents: number
  realDebitedCents: number | null
  realFullCostCents: number | null
  storedVsFullCostGapCents: number | null
  reasons: string[]
  originalCurrencies: string[]
}

const KIND: Record<Movement["kind"], string> = { debit: "Débit", refund: "Remboursement", refund_reversal: "Annulation de remboursement", fee: "Frais" }
const STATE: Record<Movement["state"], string> = {
  voided: "annulé",
  needs_review: "à examiner — non rapprochable",
  unallocated: "non rapproché",
  partially_allocated: "partiellement rapproché",
  fully_allocated: "entièrement rapproché",
  not_allocatable: "montant réglé en € inconnu",
}
const SOURCE: Record<string, string> = {
  stripe_issuing: "Carte Stripe Issuing (importée)",
  card_statement: "Relevé de carte",
  bank_statement: "Relevé bancaire",
  supplier_invoice_paid: "Facture fournisseur payée",
}
const eur = (c: number | null | undefined) => (c == null ? "—" : `${(c / 100).toFixed(2).replace(".", ",")} €`)
const money = (c: number, cur: string) => `${(c / 100).toFixed(2).replace(".", ",")} ${cur}`
const toCents = (s: string): number | null => {
  const t = s.trim().replace(/\s/g, "").replace(",", ".")
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  return Math.round(Number(t) * 100)
}
const input = "rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"

/**
 * Admin console of the procurement debit register: record a movement read from its source, reconcile it with orders,
 * revoke / void with a reason, and look at one order's cost. Nothing here pays or refunds anything.
 */
export function AdminProcurementDebitsConsole() {
  const [list, setList] = useState<{ available: boolean; movements: Movement[] } | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [form, setForm] = useState({
    kind: "debit",
    source: "card_statement",
    sourceReference: "",
    amount: "",
    currency: "EUR",
    settled: "",
    occurredAt: "",
    parentDebitId: "",
    includesDelivery: "unknown",
    vatTreatment: "unknown",
    evidenceType: "statement_line",
    evidenceText: "",
    note: "",
  })
  const [alloc, setAlloc] = useState<Record<string, { orderId: string; amount: string; basis: string; note: string }>>({})
  const [orderId, setOrderId] = useState("")
  const [orderView, setOrderView] = useState<{ available: boolean; reconciliation?: Reconciliation } | null>(null)

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/procurement-debits", { cache: "no-store" })
    if (res.ok) setList(await res.json())
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const post = async (url: string, body: unknown) => {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    const json = (await res.json().catch(() => ({}))) as { error?: string; fields?: string[]; remainingCents?: number; existingId?: string }
    return { ok: res.ok, json }
  }

  const record = async () => {
    const amountCents = toCents(form.amount)
    const settledAmountCents = form.settled.trim() ? toCents(form.settled) : null
    const evidence = form.evidenceText.trim() ? [{ type: form.evidenceType, reference: "", description: form.evidenceText.trim() }] : []
    const r = await post("/api/admin/procurement-debits", {
      kind: form.kind,
      source: form.source,
      sourceReference: form.sourceReference,
      amountCents,
      currency: form.currency,
      settledAmountCents,
      occurredAt: form.occurredAt ? new Date(`${form.occurredAt}T12:00:00`).toISOString() : null,
      parentDebitId: form.parentDebitId || null,
      includesDelivery: form.includesDelivery === "unknown" ? null : form.includesDelivery === "yes",
      vatTreatment: form.vatTreatment,
      evidence,
      note: form.note,
    })
    setMsg(r.ok ? "Mouvement enregistré." : `Refusé : ${r.json.error}${r.json.fields ? ` (${r.json.fields.join(", ")})` : ""}`)
    if (r.ok) await load()
  }

  const allocate = async (m: Movement) => {
    const a = alloc[m.id] ?? { orderId: "", amount: "", basis: "single_order", note: "" }
    const r = await post(`/api/admin/procurement-debits/${encodeURIComponent(m.id)}/allocations`, {
      orderId: a.orderId,
      amountCents: toCents(a.amount),
      basis: a.basis,
      note: a.note,
    })
    setMsg(
      r.ok
        ? "Rapprochement enregistré."
        : `Refusé : ${r.json.error}${r.json.remainingCents != null ? ` — reste attribuable ${eur(r.json.remainingCents)}` : ""}`
    )
    if (r.ok) await load()
  }

  const revoke = async (allocationId: string) => {
    const reason = window.prompt("Motif de la révocation (obligatoire)") ?? ""
    if (reason.trim().length < 3) return
    const r = await post(`/api/admin/procurement-debits/allocations/${encodeURIComponent(allocationId)}/revoke`, { reason })
    setMsg(r.ok ? "Rapprochement révoqué." : `Refusé : ${r.json.error}`)
    await load()
  }

  const resolveReview = async (m: Movement) => {
    const reason = window.prompt("Motif de la résolution (obligatoire)") ?? ""
    if (reason.trim().length < 3) return
    const needsParent = (m.kind === "refund" || m.kind === "refund_reversal") && !m.parentDebitId
    const parentDebitId = needsParent ? (window.prompt("Identifiant du débit d'origine (même carte)") ?? "").trim() : ""
    if (needsParent && !parentDebitId) return
    const r = await post(`/api/admin/procurement-debits/${encodeURIComponent(m.id)}/review`, { reason, parentDebitId: parentDebitId || null })
    setMsg(r.ok ? "Mouvement résolu (rien n'est rapproché automatiquement)." : `Refusé : ${r.json.error}`)
    await load()
  }

  const voidMovement = async (id: string) => {
    const reason = window.prompt("Motif de l'annulation (obligatoire)") ?? ""
    if (reason.trim().length < 3) return
    const r = await post(`/api/admin/procurement-debits/${encodeURIComponent(id)}/void`, { reason })
    setMsg(r.ok ? "Mouvement annulé (conservé dans le registre)." : `Refusé : ${r.json.error}`)
    await load()
  }

  const lookUp = async () => {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId.trim())}/procurement-cost`, { cache: "no-store" })
    setOrderView(res.ok ? await res.json() : null)
    if (!res.ok) setMsg("Commande introuvable.")
  }

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })
  const rec = orderView?.reconciliation

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Débits d&apos;achat — registre et rapprochement</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Ce que les comptes d&apos;Affisell ont réellement payé pour acheter à une source, et à quelles commandes chaque montant
          appartient. Prix mémorisé, montant débité et coût complet restent distincts ; un coût n&apos;est « réel » que pour une
          commande entièrement rapprochée. Enregistrer ne paie ni ne rembourse rien.
        </p>
      </header>
      {list && !list.available ? (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          Registre indisponible : la migration 20261119090000_procurement_debit_register n&apos;est pas appliquée sur cette base.
        </p>
      ) : null}
      {msg ? <p className="text-sm">{msg}</p> : null}

      <section className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">Coût d&apos;une commande</h2>
        <div className="flex gap-2">
          <input className={`${input} flex-1`} placeholder="Identifiant de commande" value={orderId} onChange={(e) => setOrderId(e.target.value)} />
          <button type="button" className={input} onClick={() => void lookUp()} disabled={!orderId.trim()}>
            Afficher
          </button>
        </div>
        {orderView && !orderView.available ? <p className="text-sm text-amber-700">Registre indisponible.</p> : null}
        {rec ? (
          <div className="space-y-1 text-sm">
            <p>
              Statut :{" "}
              <span className="font-medium">
                {rec.status === "reconciled" ? "rapprochée — coût réel constaté" : rec.status === "incomplete" ? "rapprochement incomplet" : "non rapprochée"}
              </span>
            </p>
            <p>Prix mémorisé (pas un coût) : {eur(rec.storedSourcePriceCents)}</p>
            {rec.status === "reconciled" ? (
              <>
                <p>Montant débité net : {eur(rec.realDebitedCents)} (débits {eur(rec.debitedCents)} − remboursements {eur(rec.refundedCents)})</p>
                <p>Coût complet : {eur(rec.realFullCostCents)} (dont frais {eur(rec.feesCents)})</p>
                <p>Écart coût complet − prix mémorisé : {eur(rec.storedVsFullCostGapCents)}</p>
              </>
            ) : rec.status === "incomplete" ? (
              <p className="text-zinc-600">
                Montants provisoires, ne valent pas coût réel : débits {eur(rec.debitedCents)}, remboursements {eur(rec.refundedCents)}, frais{" "}
                {eur(rec.feesCents)}.
              </p>
            ) : null}
            {rec.originalCurrencies.some((c) => c !== "EUR") ? (
              <p className="text-xs text-zinc-500">Devises d&apos;origine : {rec.originalCurrencies.join(", ")} — seuls les euros réglés comptent.</p>
            ) : null}
            {rec.reasons.length > 0 ? (
              <ul className="list-disc pl-5 text-xs text-amber-700">
                {rec.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">Enregistrer un mouvement lu à sa source</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <select className={input} value={form.kind} onChange={set("kind")}>
            <option value="debit">Débit</option>
            <option value="refund">Remboursement d&apos;un débit</option>
            <option value="refund_reversal">Annulation d&apos;un remboursement</option>
            <option value="fee">Frais</option>
          </select>
          <select className={input} value={form.source} onChange={set("source")}>
            {Object.entries(SOURCE)
              .filter(([k]) => k !== "stripe_issuing")
              .map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
              ))}
          </select>
          <input className={input} placeholder="Référence de transaction" value={form.sourceReference} onChange={set("sourceReference")} />
          <input className={input} placeholder="Montant débité (devise d'origine)" value={form.amount} onChange={set("amount")} />
          <input className={input} placeholder="Devise (EUR, USD…)" value={form.currency} onChange={set("currency")} />
          <input className={input} placeholder="Montant réglé en € (si autre devise)" value={form.settled} onChange={set("settled")} />
          <input className={input} type="date" value={form.occurredAt} onChange={set("occurredAt")} />
          {form.kind !== "debit" ? (
            <input className={input} placeholder="Identifiant du débit concerné" value={form.parentDebitId} onChange={set("parentDebitId")} />
          ) : (
            <span />
          )}
          <select className={input} value={form.includesDelivery} onChange={set("includesDelivery")}>
            <option value="unknown">Livraison incluse : inconnu</option>
            <option value="yes">Livraison incluse</option>
            <option value="no">Livraison non incluse</option>
          </select>
          <select className={input} value={form.vatTreatment} onChange={set("vatTreatment")}>
            <option value="unknown">TVA : inconnue</option>
            <option value="included">TVA incluse</option>
            <option value="excluded">Hors TVA</option>
          </select>
          <select className={input} value={form.evidenceType} onChange={set("evidenceType")}>
            <option value="statement_line">Ligne de relevé</option>
            <option value="receipt">Reçu</option>
            <option value="invoice">Facture</option>
            <option value="source_order_record">Commande chez la source</option>
            <option value="other">Autre</option>
          </select>
          <input className={input} placeholder="Justificatif (n°, date — jamais de n° de carte)" value={form.evidenceText} onChange={set("evidenceText")} />
          <input className={`${input} sm:col-span-3`} placeholder="Note" value={form.note} onChange={set("note")} />
        </div>
        <button type="button" className={input} onClick={() => void record()} disabled={!form.sourceReference.trim() || !form.amount.trim()}>
          Enregistrer
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Mouvements enregistrés</h2>
        {list?.movements.length === 0 ? <p className="text-sm text-zinc-500">Aucun mouvement.</p> : null}
        {list?.movements.map((m) => {
          const a = alloc[m.id] ?? { orderId: "", amount: "", basis: "single_order", note: "" }
          return (
            <article key={m.id} className="space-y-2 rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800">
              <p>
                <span className="font-medium">{KIND[m.kind]}</span> · {SOURCE[m.source] ?? m.source} · {m.sourceReference} ·{" "}
                {new Date(m.occurredAt).toLocaleDateString("fr-FR")} · {money(m.amountCents, m.currency)}
                {m.currency !== "EUR" ? ` → ${m.settledAmountCents == null ? "montant réglé en € inconnu" : eur(m.settledAmountCents)}` : ""}
                {m.status === "voided" ? <span className="text-red-700"> · annulé ({m.voidReason})</span> : null}
              </p>
              <p className="text-xs">
                <span className={m.state === "needs_review" ? "font-medium text-amber-700" : "text-zinc-600"}>{STATE[m.state]}</span>
                {" · "}
                {m.amountOrigin === "read_from_source" ? "montants lus à la source (Stripe)" : "montants saisis d'après justificatif"}
                {m.balanceTransactionId ? ` · ${m.balanceTransactionId}` : ""}
                {m.reviewReason ? ` · ${m.reviewReason}` : ""}
              </p>
              <p className="text-xs text-zinc-500">
                id {m.id}
                {m.parentDebitId ? ` · rattaché au débit ${m.parentDebitId}` : ""} · réparti {eur(m.balance.allocatedCents)} · reste {eur(m.balance.remainingCents)}
              </p>
              {m.allocations.length > 0 ? (
                <ul className="space-y-1 text-xs">
                  {m.allocations.map((al) => (
                    <li key={al.id} className={al.status === "active" ? "" : "text-zinc-400 line-through"}>
                      commande {al.orderId} · {eur(al.amountCents)} · {al.basis}
                      {al.note ? ` · ${al.note}` : ""}
                      {al.status === "active" ? (
                        <button type="button" className="ml-2 underline" onClick={() => void revoke(al.id)}>
                          révoquer
                        </button>
                      ) : (
                        ` (révoqué : ${al.revokeReason ?? ""})`
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
              {m.state === "needs_review" ? (
                <button type="button" className={input} onClick={() => void resolveReview(m)}>
                  Résoudre l&apos;examen
                </button>
              ) : null}
              {m.status === "recorded" && m.state !== "needs_review" ? (
                <div className="flex flex-wrap gap-2">
                  <input className={input} placeholder="Commande" value={a.orderId} onChange={(e) => setAlloc({ ...alloc, [m.id]: { ...a, orderId: e.target.value } })} />
                  <input className={input} placeholder="Montant en €" value={a.amount} onChange={(e) => setAlloc({ ...alloc, [m.id]: { ...a, amount: e.target.value } })} />
                  <select className={input} value={a.basis} onChange={(e) => setAlloc({ ...alloc, [m.id]: { ...a, basis: e.target.value } })}>
                    <option value="single_order">Une seule commande</option>
                    <option value="grouped_split">Achat groupé — part</option>
                    <option value="partial_payment">Paiement partiel</option>
                    <option value="manual">Manuel (motif)</option>
                  </select>
                  <input className={input} placeholder="Note" value={a.note} onChange={(e) => setAlloc({ ...alloc, [m.id]: { ...a, note: e.target.value } })} />
                  <button type="button" className={input} onClick={() => void allocate(m)}>
                    Rapprocher
                  </button>
                  <button type="button" className={`${input} text-red-700`} onClick={() => void voidMovement(m.id)}>
                    Annuler le mouvement
                  </button>
                </div>
              ) : null}
            </article>
          )
        })}
      </section>
    </div>
  )
}

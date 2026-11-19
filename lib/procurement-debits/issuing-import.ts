/**
 * Stripe Issuing → procurement debit register: READ-ONLY import, pure planning (founder decision 2026-11-19).
 * Nothing here calls Stripe; `issuing-import.server.ts` applies a plan with an injected reader that can only GET.
 *
 * Which Stripe objects, and why (docs.stripe.com/issuing/purchases/transactions, read 2026-11-19):
 *  - `issuing.transaction` is the ONLY object that becomes a movement: it is money that entered or left the Issuing
 *    balance. `type: capture` with a NEGATIVE `amount` → debit; `type: refund` with a POSITIVE amount → refund; a
 *    `refund` with a NEGATIVE amount is a refund reversal (rare). `amount` / `currency` = what the balance really took
 *    (the card's currency — EUR for Affisell's cards), `merchant_amount` / `merchant_currency` = what the merchant
 *    charged (kept as the ORIGINAL amount). `balance_transaction` (txn_, may be null) and `authorization` (iauth_, may be
 *    null: force captures, unlinked refunds) are kept as evidence ids. The card id (ic_) is an object id, not card data.
 *  - `issuing.authorization` is a HOLD, not money: never a movement. A capture closes it; a reversed / expired one
 *    leaves nothing. (Reading authorizations is not needed to know what was paid.)
 *  - Stripe says refund linking is "an inexact science": a refund may link to an unrelated authorization or to none.
 *    So a refund is tied to a capture only when that is CERTAIN: same card AND (the same authorization as exactly one
 *    capture, or the card has exactly one capture — Affisell's cards are single-use, one per order). Otherwise it is
 *    recorded APART (`needs_review`) for a person to tie — never guessed.
 *  - Partial / over / multi / force captures are each their own transaction → each its own debit.
 * Automatic allocation only from Affisell's own record: a card tied to EXACTLY ONE order (`FulfillmentLog.virtualCardId`)
 * gets its captures allocated to that order in full; refunds follow their capture's order. Anything else stays
 * unallocated and visible. Idempotence: the transaction id is the register's unique reference; a transaction already
 * recorded is skipped — and if Stripe now reports different figures it is flagged, never rewritten.
 */
export type IssuingTransaction = {
  id: string
  type: "capture" | "refund"
  /** Signed, minor units of `currency` (negative = money out). */
  amount: number
  currency: string
  merchantAmount: number
  merchantCurrency: string
  authorization: string | null
  card: string
  balanceTransaction: string | null
  created: number
  livemode: boolean
}

const ID = {
  ipi: /^ipi_[A-Za-z0-9]+$/,
  ic: /^ic_[A-Za-z0-9]+$/,
  iauth: /^iauth_[A-Za-z0-9]+$/,
  txn: /^txn_[A-Za-z0-9]+$/,
}

/** Strict reading of one object of `GET /v1/issuing/transactions`. Anything unexpected = not imported (reported). */
export function parseIssuingTransaction(raw: unknown): { ok: true; value: IssuingTransaction } | { ok: false; reason: string } {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null
  if (!o || o.object !== "issuing.transaction") return { ok: false, reason: "objet_inattendu" }
  const id = typeof o.id === "string" && ID.ipi.test(o.id) ? o.id : null
  if (!id) return { ok: false, reason: "identifiant_illisible" }
  const type = o.type === "capture" || o.type === "refund" ? o.type : null
  if (!type) return { ok: false, reason: "type_inconnu" }
  const int = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : null)
  const amount = int(o.amount)
  const merchantAmount = int(o.merchant_amount)
  if (amount === null || merchantAmount === null) return { ok: false, reason: "montant_illisible" }
  const cur = (v: unknown) => (typeof v === "string" && /^[a-z]{3}$/i.test(v) ? v.toUpperCase() : null)
  const currency = cur(o.currency)
  const merchantCurrency = cur(o.merchant_currency)
  if (!currency || !merchantCurrency) return { ok: false, reason: "devise_illisible" }
  const idOf = (v: unknown, re: RegExp) => {
    if (typeof v === "string") return re.test(v) ? v : undefined
    if (v && typeof v === "object" && typeof (v as { id?: unknown }).id === "string") return re.test((v as { id: string }).id) ? (v as { id: string }).id : undefined
    return v == null ? null : undefined
  }
  const card = idOf(o.card, ID.ic)
  if (!card) return { ok: false, reason: "carte_illisible" }
  const authorization = idOf(o.authorization, ID.iauth)
  const balanceTransaction = idOf(o.balance_transaction, ID.txn)
  if (authorization === undefined || balanceTransaction === undefined) return { ok: false, reason: "reference_illisible" }
  const created = int(o.created)
  if (created === null || created <= 0) return { ok: false, reason: "date_illisible" }
  if (typeof o.livemode !== "boolean") return { ok: false, reason: "mode_illisible" }
  return {
    ok: true,
    value: { id, type, amount, currency, merchantAmount, merchantCurrency, authorization, card, balanceTransaction, created, livemode: o.livemode },
  }
}

/** A movement already in the register (by its transaction id). */
export type ExistingImported = {
  id: string
  sourceReference: string
  kind: "debit" | "refund" | "refund_reversal" | "fee"
  amountCents: number
  settledAmountCents: number | null
  issuingCardId: string | null
  issuingAuthorizationId: string | null
}

export type PlannedMovement = {
  reference: string
  kind: "debit" | "refund" | "refund_reversal"
  amountCents: number
  currency: string
  settledAmountCents: number | null
  occurredAt: string
  issuingCardId: string
  issuingAuthorizationId: string | null
  balanceTransactionId: string | null
  /** The capture it gives back: an existing movement id, or the reference of a capture planned in the same batch. */
  parent: { existingId: string } | { reference: string } | null
  reviewReason: string | null
  /** The order to allocate the whole settled amount to, from Affisell's own card → order record. */
  autoAllocateOrderId: string | null
  note: string
}

export type IssuingImportPlan = {
  record: PlannedMovement[]
  /** Already recorded with the same figures. */
  alreadyRecorded: string[]
  /** Already recorded but Stripe now reports other figures: flagged for a person, never rewritten. */
  changedAtSource: Array<{ reference: string; reason: string }>
  /** Not imported at all (unreadable, zero amount, test/live mix…). */
  skipped: Array<{ reference: string | null; reason: string }>
  /** Recorded without allocation, and why. */
  notAllocated: Array<{ reference: string; reason: string }>
}

export function planIssuingImport(args: {
  transactions: ReadonlyArray<IssuingTransaction>
  existing: ReadonlyArray<ExistingImported>
  /** card id → order ids tied to it by `FulfillmentLog.virtualCardId`. */
  cardOrders: ReadonlyMap<string, ReadonlyArray<string>>
  /** The mode the key works in: a transaction of the other mode is never imported. */
  livemode: boolean
}): IssuingImportPlan {
  const plan: IssuingImportPlan = { record: [], alreadyRecorded: [], changedAtSource: [], skipped: [], notAllocated: [] }
  const byRef = new Map(args.existing.map((e) => [e.sourceReference, e]))
  // Captures first (oldest first) so a refund of the same batch can find its capture.
  const txs = [...args.transactions].sort((a, b) => (a.type === b.type ? a.created - b.created : a.type === "capture" ? -1 : 1))
  type Capture = { ref: string; authorization: string | null; existingId: string | null }
  const capturesByCard = new Map<string, Capture[]>()
  for (const e of args.existing) {
    if (e.kind !== "debit" || !e.issuingCardId) continue
    capturesByCard.set(e.issuingCardId, [...(capturesByCard.get(e.issuingCardId) ?? []), { ref: e.sourceReference, authorization: e.issuingAuthorizationId, existingId: e.id }])
  }
  const seen = new Set<string>()
  for (const t of txs) {
    if (seen.has(t.id)) continue
    seen.add(t.id)
    if (t.livemode !== args.livemode) {
      plan.skipped.push({ reference: t.id, reason: "mode_test_live_different" })
      continue
    }
    if (t.amount === 0) {
      plan.skipped.push({ reference: t.id, reason: "montant_nul" })
      continue
    }
    const kind = t.type === "capture" ? (t.amount < 0 ? "debit" : null) : t.amount > 0 ? "refund" : "refund_reversal"
    if (!kind) {
      plan.skipped.push({ reference: t.id, reason: "capture_de_montant_positif" })
      continue
    }
    const settled = Math.abs(t.amount)
    // Original = what the merchant charged. In euros the register keeps ONE figure (the debited one); a different
    // merchant figure in euros is a contradiction kept for review.
    let amountCents = Math.abs(t.merchantAmount)
    let currency = t.merchantCurrency
    const reviews: string[] = []
    if (t.currency !== "EUR") reviews.push(`devise du solde ${t.currency} : montant réglé en euros inconnu`)
    if (currency === "EUR" && t.currency === "EUR" && amountCents !== settled) {
      reviews.push("montant marchand en euros différent du montant débité")
      amountCents = settled
    }
    if (amountCents === 0 || (currency === "EUR" && t.currency !== "EUR")) {
      // No usable merchant figure, or a euro figure the balance did not take in euros: keep the balance's own figure.
      amountCents = settled
      currency = t.currency
    }
    const existing = byRef.get(t.id)
    if (existing) {
      const same = existing.amountCents === amountCents && existing.settledAmountCents === (t.currency === "EUR" ? settled : null)
      if (same) plan.alreadyRecorded.push(t.id)
      else plan.changedAtSource.push({ reference: t.id, reason: "montants_differents_de_l_enregistrement" })
      continue
    }
    let parent: PlannedMovement["parent"] = null
    let note = ""
    if (kind !== "debit") {
      const captures = capturesByCard.get(t.card) ?? []
      const sameAuth = t.authorization ? captures.filter((c) => c.authorization === t.authorization) : []
      const chosen = sameAuth.length === 1 ? sameAuth[0]! : captures.length === 1 ? captures[0]! : null
      if (chosen) {
        parent = chosen.existingId ? { existingId: chosen.existingId } : { reference: chosen.ref }
        note = sameAuth.length === 1 ? "rattaché par l'autorisation et la carte" : "rattaché au seul achat de la carte à usage unique"
      } else {
        reviews.push(captures.length === 0 ? "aucun achat connu sur cette carte" : "plusieurs achats sur la carte : rattachement incertain")
      }
    } else {
      capturesByCard.set(t.card, [...(capturesByCard.get(t.card) ?? []), { ref: t.id, authorization: t.authorization, existingId: null }])
    }
    const orders = args.cardOrders.get(t.card) ?? []
    let auto: string | null = null
    const reviewReason = reviews.length ? reviews.join(" ; ") : null
    if (reviewReason) plan.notAllocated.push({ reference: t.id, reason: "a_examiner" })
    else if (orders.length === 1) auto = orders[0]!
    else plan.notAllocated.push({ reference: t.id, reason: orders.length === 0 ? "carte_sans_commande" : "carte_liee_a_plusieurs_commandes" })
    plan.record.push({
      reference: t.id,
      kind,
      amountCents,
      currency,
      settledAmountCents: t.currency === "EUR" ? settled : null,
      occurredAt: new Date(t.created * 1000).toISOString(),
      issuingCardId: t.card,
      issuingAuthorizationId: t.authorization,
      balanceTransactionId: t.balanceTransaction,
      parent,
      reviewReason,
      autoAllocateOrderId: auto,
      note,
    })
  }
  return plan
}

/** Where the next run starts: the last transaction read, minus an overlap (idempotence makes re-reading safe). */
export const IMPORT_OVERLAP_SECONDS = 2 * 86_400
export function nextImportStart(lastCreated: number | null, fallback: number): number {
  return lastCreated && lastCreated > 0 ? Math.max(0, lastCreated - IMPORT_OVERLAP_SECONDS) : fallback
}

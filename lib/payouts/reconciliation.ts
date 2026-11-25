/**
 * Affisell ↔ Stripe payout reconciliation — PURE (no database, no Stripe). READ-ONLY by construction: it only compares
 * two inventories and lists what does not match. It never proposes to create, reverse or rewrite anything automatically.
 *
 * Inputs: the Stripe transfers of a window (as listed by GET /v1/transfers) and what Affisell recorded (payout legs,
 * transfer attempts, ledger rows, order references). Output: findings, each with a severity and the evidence, so a person
 * can settle it with the documented procedures (docs/PAYOUT-LEG-REGISTRY.md §8).
 */
import { orderLegKey, transferLegKeyOf, type PayoutLegKind, type StripeTransferView } from "@/lib/payouts/leg-model"

export type RecLeg = {
  legKey: string
  kind: string
  role: string
  orderId: string | null
  state: string
  stripeTransferId: string | null
  amountCents: number | null
  destination: string | null
  inDoubtReason: string | null
}
export type RecAttempt = {
  orderId: string
  role: "SUPPLIER" | "AFFILIATE"
  status: string
  stripeTransferId: string | null
  amountCents: number
  destination: string
}
export type RecLedger = {
  orderId: string | null
  beneficiaryRole: string
  entryType: string
  stripeTransferId: string | null
  amountCents: number
  payoutRail: string
}
export type RecOrderRef = { orderId: string; stripeTransferId: string | null; payoutTransferIds: string[] }

export type ReconciliationInput = {
  /** Stripe transfers of the window; `null` when Stripe was not read (plan mode). */
  stripe: { transfers: StripeTransferView[]; complete: boolean; since: Date } | null
  legs: RecLeg[]
  attempts: RecAttempt[]
  ledger: RecLedger[]
  orderRefs: RecOrderRef[]
}

export type FindingKind =
  /** A Stripe transfer nobody at Affisell records (no leg, attempt, ledger row or order reference). */
  | "orphan_transfer"
  /** Several Stripe transfers belong to the same leg: a double payment (or a legacy duplicate) to settle by hand. */
  | "duplicate_transfers_for_leg"
  /** A Stripe transfer of a leg the registry does not hold as PAID (in doubt, pending…): reconcile → adopt. */
  | "transfer_of_unpaid_leg"
  /** Affisell records a transfer id the Stripe inventory of the window does not contain. */
  | "recorded_transfer_not_in_stripe"
  /** The same transfer, different amount / destination between Stripe and Affisell's records. */
  | "amount_mismatch"
  | "destination_mismatch"
  /** The ledger names a role the transfer's metadata contradicts. */
  | "role_mismatch"
  /** A leg waiting for a human decision. */
  | "leg_in_doubt"
  /** A connect / lightning ledger payout without a transfer id: money said to move, nothing to check it against. */
  | "ledger_payout_without_transfer"
  /** An order references a transfer no attempt, ledger row or leg records (legacy fields). */
  | "order_reference_unrecorded"

export type Finding = {
  kind: FindingKind
  severity: "critical" | "major" | "minor"
  legKey: string | null
  transferIds: string[]
  detail: string
}

const SEVERITY: Record<FindingKind, Finding["severity"]> = {
  orphan_transfer: "critical",
  duplicate_transfers_for_leg: "critical",
  transfer_of_unpaid_leg: "major",
  recorded_transfer_not_in_stripe: "major",
  amount_mismatch: "critical",
  destination_mismatch: "critical",
  role_mismatch: "major",
  leg_in_doubt: "major",
  ledger_payout_without_transfer: "minor",
  order_reference_unrecorded: "major",
}

function legKeyOfAttempt(a: { orderId: string; role: "SUPPLIER" | "AFFILIATE" }) {
  return orderLegKey(a.orderId, a.role)
}

function ledgerRoleOfTransfer(t: StripeTransferView): string | null {
  const key = transferLegKeyOf(t, "order")
  if (key === "unidentified") return null
  return key.split(":")[2] ?? null
}

export function reconcilePayouts(input: ReconciliationInput): Finding[] {
  const findings: Finding[] = []
  const push = (kind: FindingKind, f: Omit<Finding, "kind" | "severity">) =>
    findings.push({ kind, severity: SEVERITY[kind], ...f })

  // ---- Affisell-side consistency (works without Stripe) ----
  for (const leg of input.legs) {
    if (leg.state === "IN_DOUBT") {
      push("leg_in_doubt", { legKey: leg.legKey, transferIds: [], detail: leg.inDoubtReason ?? "in_doubt" })
    }
  }
  for (const row of input.ledger) {
    if ((row.payoutRail === "connect" || row.payoutRail === "lightning") && !row.stripeTransferId) {
      push("ledger_payout_without_transfer", {
        legKey: row.orderId ? `order:${row.orderId}:${row.beneficiaryRole}` : null,
        transferIds: [],
        detail: `${row.entryType} ${row.payoutRail}`,
      })
    }
  }
  const recorded = new Set<string>()
  for (const l of input.legs) if (l.stripeTransferId) recorded.add(l.stripeTransferId)
  for (const a of input.attempts) if (a.stripeTransferId) recorded.add(a.stripeTransferId)
  for (const r of input.ledger) if (r.stripeTransferId) recorded.add(r.stripeTransferId)
  for (const o of input.orderRefs) {
    const refs = [o.stripeTransferId, ...o.payoutTransferIds].filter((x): x is string => Boolean(x))
    for (const id of refs) {
      const known =
        input.legs.some((l) => l.stripeTransferId === id) ||
        input.attempts.some((a) => a.stripeTransferId === id) ||
        input.ledger.some((r) => r.stripeTransferId === id)
      if (!known) push("order_reference_unrecorded", { legKey: null, transferIds: [id], detail: `order ${o.orderId}` })
    }
  }

  if (!input.stripe) return findings

  // ---- Stripe side ----
  const byId = new Map(input.stripe.transfers.map((t) => [t.id, t]))
  const allRefs = new Set(recorded)
  for (const o of input.orderRefs) {
    if (o.stripeTransferId) allRefs.add(o.stripeTransferId)
    for (const id of o.payoutTransferIds) allRefs.add(id)
  }

  const perLeg = new Map<string, StripeTransferView[]>()
  for (const t of input.stripe.transfers) {
    const leg = input.legs.find((l) => l.stripeTransferId === t.id)
    const kind = (leg?.kind ?? "order") as PayoutLegKind
    const key = leg?.legKey ?? transferLegKeyOf(t, kind)
    if (key !== "unidentified") perLeg.set(key, [...(perLeg.get(key) ?? []), t])
    if (!allRefs.has(t.id)) {
      push("orphan_transfer", {
        legKey: key === "unidentified" ? null : key,
        transferIds: [t.id],
        detail: `${t.amount} ${t.currency} → ${t.destination ?? "?"} group=${t.transfer_group ?? "-"}`,
      })
    }
  }
  for (const [legKey, ts] of perLeg) {
    if (ts.length > 1) {
      push("duplicate_transfers_for_leg", { legKey, transferIds: ts.map((t) => t.id), detail: `${ts.length} transfers` })
    }
    const leg = input.legs.find((l) => l.legKey === legKey)
    if (leg && leg.state !== "PAID" && ts.length === 1) {
      push("transfer_of_unpaid_leg", { legKey, transferIds: [ts[0].id], detail: `leg ${leg.state}` })
    }
  }

  const compare = (id: string, amountCents: number | null, destination: string | null, legKey: string | null) => {
    const t = byId.get(id)
    if (!t) return
    if (amountCents !== null && t.amount !== amountCents) {
      push("amount_mismatch", { legKey, transferIds: [id], detail: `stripe ${t.amount} ≠ affisell ${amountCents}` })
    }
    if (destination && t.destination && t.destination !== destination) {
      push("destination_mismatch", { legKey, transferIds: [id], detail: "destination differs" })
    }
  }
  for (const l of input.legs) if (l.stripeTransferId) compare(l.stripeTransferId, l.amountCents, l.destination, l.legKey)
  for (const a of input.attempts) {
    if (a.status === "SUCCESS" && a.stripeTransferId) compare(a.stripeTransferId, a.amountCents, a.destination, legKeyOfAttempt(a))
  }
  for (const r of input.ledger) {
    if (!r.stripeTransferId) continue
    compare(r.stripeTransferId, r.amountCents, null, null)
    const t = byId.get(r.stripeTransferId)
    const metaRole = t ? ledgerRoleOfTransfer(t) : null
    if (t && metaRole && r.beneficiaryRole !== metaRole) {
      push("role_mismatch", { legKey: null, transferIds: [t.id], detail: `ledger ${r.beneficiaryRole} ≠ transfer ${metaRole}` })
    }
  }

  // Recorded ids absent from Stripe — only meaningful when the inventory is complete; the window caveat is in `detail`.
  if (input.stripe.complete) {
    const since = input.stripe.since.toISOString().slice(0, 10)
    for (const id of recorded) {
      if (!byId.has(id)) {
        push("recorded_transfer_not_in_stripe", {
          legKey: input.legs.find((l) => l.stripeTransferId === id)?.legKey ?? null,
          transferIds: [id],
          detail: `absent from Stripe transfers created since ${since} (may be older than the window)`,
        })
      }
    }
  }
  return findings
}

/** Masks an identifier for printing: `tr_1Abc…` keeps a short prefix only. */
export function maskId(id: string): string {
  return id.length <= 8 ? id : `${id.slice(0, 7)}…`
}

export function summarize(findings: Finding[]): Record<FindingKind, number> {
  const out = {} as Record<FindingKind, number>
  for (const k of Object.keys(SEVERITY) as FindingKind[]) out[k] = 0
  for (const f of findings) out[f.kind] += 1
  return out
}

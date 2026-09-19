// READ-ONLY audit of marketplace money splits. Never writes, never calls Stripe.
// Usage: node --env-file=.env.local scripts/audit-money-splits.mjs [--limit=5000] [--json]
import { PrismaClient } from "@prisma/client"

const limit = Number((process.argv.find((a) => a.startsWith("--limit=")) ?? "--limit=5000").split("=")[1])
const asJson = process.argv.includes("--json")
const p = new PrismaClient()

const orders = await p.order.findMany({
  where: { status: { in: ["paid", "shipped", "delivered", "preparing", "completed"] } },
  orderBy: { createdAt: "desc" },
  take: limit,
  select: {
    id: true, createdAt: true, status: true, currency: true, quantity: true,
    sellingPriceCents: true, subtotalCents: true, taxCents: true, totalCents: true, basePriceCents: true,
    supplierPayoutCents: true, affiliatePayoutCents: true, commissionCents: true,
    supplierFeeCents: true, affiliateFeeCents: true, affisellFeeCents: true,
    affiliateMarginCents: true, affiliateMarginRetainedCents: true,
    usesAffisellAutoBuy: true, splitStatus: true, payoutStatus: true, supplierCommissionRateBps: true,
    transferAttempts: { select: { role: true, status: true, amountCents: true, stripeTransferId: true, attempts: true, errorCode: true } },
  },
})

const findings = { total: orders.length, byKind: {}, samples: {} }
const flag = (kind, o, extra = {}) => {
  findings.byKind[kind] = (findings.byKind[kind] ?? 0) + 1
  ;(findings.samples[kind] ??= []).length < 5 && findings.samples[kind].push({ id: o.id, ...extra })
}

for (const o of orders) {
  const H = o.subtotalCents ?? o.sellingPriceCents
  const att = o.transferAttempts
  const sup = att.find((a) => a.role === "SUPPLIER")
  const aff = att.find((a) => a.role === "AFFILIATE")
  const paid = (a) => (a?.status === "SUCCESS" ? a.amountCents : 0)
  const scheduled = (att.reduce((s, a) => s + a.amountCents, 0))

  if (o.currency && o.currency.toUpperCase() !== "EUR") flag("non_eur_currency", o, { currency: o.currency })
  if (scheduled > H) flag("scheduled_transfers_exceed_line_ht", o, { H, scheduled })
  if (paid(sup) + paid(aff) > H) flag("PAID_OUT_EXCEEDS_LINE_HT", o, { H, paid: paid(sup) + paid(aff) })
  const allocated = (o.supplierPayoutCents ?? 0) + (o.affiliatePayoutCents ?? 0) + (o.supplierFeeCents ?? 0) + (o.affiliateFeeCents ?? 0)
  const drift = H - allocated
  if (drift < -2) flag("over_allocated_vs_line_ht", o, { H, allocated, drift })
  if (drift > 2) flag("under_allocated_vs_line_ht", o, { H, allocated, drift })
  if ((o.basePriceCents ?? 0) > H) flag("sold_below_wholesale", o, { H, W: o.basePriceCents })
  if (sup && sup.amountCents !== o.supplierPayoutCents) flag("supplier_attempt_vs_order_payout_mismatch", o, { attempt: sup.amountCents, order: o.supplierPayoutCents })
  if (att.some((a) => a.status === "SUCCESS" && !a.stripeTransferId)) flag("success_without_transfer_id", o)
  if (att.some((a) => a.status === "FAILED")) flag("failed_attempt", o, { codes: att.filter((a) => a.status === "FAILED").map((a) => a.errorCode) })
  if (o.splitStatus === "SUCCESS" && att.some((a) => a.status !== "SUCCESS")) flag("split_success_but_attempt_not_success", o)
  const expectedTotal = (o.subtotalCents ?? o.sellingPriceCents) + (o.taxCents ?? 0)
  if ((o.taxCents ?? 0) > 0 && (o.totalCents ?? 0) < expectedTotal - 1) flag("total_cents_excludes_vat", o, { total: o.totalCents, subtotal: o.subtotalCents, tax: o.taxCents, expected: expectedTotal, split: o.splitStatus })
  if (o.commissionCents === 0 && (o.supplierCommissionRateBps ?? 0) > 0 && (o.basePriceCents ?? 0) > 0) flag("commission_zero_but_bps_positive", o, { bps: o.supplierCommissionRateBps, W: o.basePriceCents })
  const fixedMargin = (o.affiliateMarginCents ?? 0) > 0
  findings.byKind[fixedMargin ? "kind_margin_field_positive" : "kind_margin_field_zero"] = (findings.byKind[fixedMargin ? "kind_margin_field_positive" : "kind_margin_field_zero"] ?? 0) + 1
}

console.log(asJson ? JSON.stringify(findings, null, 2) : findings)
await p.$disconnect()

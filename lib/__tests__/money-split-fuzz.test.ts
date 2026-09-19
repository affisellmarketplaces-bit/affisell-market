import { describe, expect, it } from "vitest"

import { computeOrderEscrowAllocation } from "@/lib/order-escrow-allocation"
import { computeMarketplaceOrderSettlement } from "@/lib/marketplace-order-settlement"
import { computeSaleSplit, supplierFeeBpsForCategory } from "@/lib/money/sale-split"
import { resolveLineMarkupCents } from "@/lib/money/sale-split"
import {
  checkTransferBudget,
  orderTransferCeilingCents,
  platformSubsidyCents,
} from "@/lib/money/split-guard"
import {
  computeTransferAmountsFromOrder,
  orderSplitInputFromOrder,
} from "@/lib/marketplace-split-amounts"
import {
  buildPhase1FeesForOrderLine,
} from "@/lib/marketplace-supplier-fee"
import {
  netSupplierPayoutCents,
  phase1AffiliateMarginRetainedCents,
} from "@/lib/marketplace-phase1-fees"

/** Seeded PRNG (mulberry32) — deterministic fuzzing without a new dependency. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Line = {
  W: number
  H: number
  qty: number
  bpsC: number
  fixedMarginPerUnit: number
  affisellBps: number
  autoBuy: boolean
  aeWholesale: number | null
}

/** Mirrors lib/stripe-marketplace-fulfill.ts order creation, then the transfer scheduler. */
function pipeline(l: Line) {
  const fixedMargin = l.fixedMarginPerUnit > 0 ? l.fixedMarginPerUnit * l.qty : null
  const settlement = computeMarketplaceOrderSettlement({
    sellingPriceCents: l.H,
    supplierPriceCents: l.W,
    supplierCommissionRateBps: l.bpsC,
    affiliateMarginCents: fixedMargin ?? undefined,
    affisellCommissionRateBps: l.affisellBps,
    affisellFeeBaseCents: l.H,
  })
  const grossMarkup = resolveLineMarkupCents({
    collectedHtCents: l.H,
    wholesaleCents: l.W,
    fixedListingMarginCents: fixedMargin,
  })
  const phase1 = buildPhase1FeesForOrderLine({
    usesAffisellAutoBuy: l.autoBuy,
    supplier: {},
    supplierPriceCents: l.W,
    aeWholesaleCents: l.aeWholesale,
    affiliateCommissionCents: settlement.affiliateCommissionCents,
    affiliateMarginRetainedCents: grossMarkup,
    affiliatePlatformFeeBps: null,
    categoryFeeBps: l.affisellBps,
  })
  const retained = phase1AffiliateMarginRetainedCents({
    clientLineHtCents: l.H,
    supplierPriceCents: l.W,
    affiliateCommissionCents: settlement.affiliateCommissionCents,
    affiliateFeeCents: phase1.affiliateFeeCents,
    fixedListingMarginCents: fixedMargin ?? undefined,
  })
  const supplierNet = netSupplierPayoutCents({
    supplierPriceCents: l.W,
    affiliateCommissionCents: settlement.affiliateCommissionCents,
    supplierFeeCents: phase1.supplierFeeCents,
  })
  const escrow = computeOrderEscrowAllocation({
    usesAffisellAutoBuy: l.autoBuy,
    aeWholesaleCents: l.aeWholesale,
    supplierPayoutCents: supplierNet,
  })
  const unitSupplier = Math.round(l.W / l.qty)

  const order = {
    basePriceCents: l.W,
    sellingPriceCents: settlement.sellingPriceCents,
    subtotalCents: settlement.affisellFeeBaseCents,
    commissionCents: settlement.affiliateCommissionCents,
    affiliatePayoutCents: settlement.affiliateCommissionCents,
    affiliateMarginRetainedCents: retained,
    affisellFeeCents: phase1.affisellFeeTotalCents,
    affiliateFeeCents: phase1.affiliateFeeCents,
    supplierFeeCents: phase1.supplierFeeCents,
    usesAffisellAutoBuy: l.autoBuy,
    aeWholesaleCents: l.aeWholesale,
    supplierPriceCents: unitSupplier * l.qty,
    affiliateMarginCents: retained,
    supplierCommissionRateBps: l.bpsC,
    affisellCommissionRateBps: l.affisellBps,
    supplierPayoutCents: supplierNet,
  }
  const amounts = computeTransferAmountsFromOrder(
    orderSplitInputFromOrder(order, { firstSchedule: true })
  )
  return { settlement, phase1, retained, supplierNet, escrow, order, amounts, fixedMargin }
}

function randomLine(r: () => number, opts: { belowWholesale?: boolean } = {}): Line {
  const qty = 1 + Math.floor(r() * 4)
  const W = Math.round((100 + r() * 60_000) / qty) * qty
  const fixed = r() < 0.5
  const fixedMarginPerUnit = fixed ? Math.round(50 + r() * 8000) : 0
  const H = fixed
    ? W + fixedMarginPerUnit * qty
    : Math.max(0, Math.round(W * ((opts.belowWholesale ? 0.5 : 1) + r() * 1.6)))
  const autoBuy = r() < 0.3
  return {
    W,
    H,
    qty,
    bpsC: Math.round(r() * 3000),
    fixedMarginPerUnit,
    affisellBps: 500 + Math.round(r() * 1500),
    autoBuy,
    aeWholesale: autoBuy ? Math.round(W * (0.3 + r() * 0.6)) : null,
  }
}

// 20k random lines x several invariants: allow generous time so a loaded machine never turns it into a flaky timeout.
describe("money split — fuzz invariants on the real checkout → transfer chain", { timeout: 90_000 }, () => {
  const N = 20_000
  const fixedMarginLine = (r: () => number): Line => {
    for (;;) {
      const l = randomLine(r)
      if (l.fixedMarginPerUnit > 0) return l
    }
  }

  it("every line sold at its list price conserves the sale exactly: supplier + affiliate + fees == H", () => {
    const r = rng(1337)
    for (let i = 0; i < N; i++) {
      const l = randomLine(r)
      const { amounts } = pipeline(l)
      const allocated =
        amounts.supplierPayoutCents +
        amounts.affiliateTransferCents +
        amounts.supplierFeeCents +
        amounts.affiliateFeeCents
      expect(allocated).toBe(l.H)
    }
  })

  it("money out never exceeds the sale for any line sold at or above wholesale", () => {
    const r = rng(42)
    for (let i = 0; i < N; i++) {
      const l = randomLine(r)
      const { amounts } = pipeline(l)
      const out = amounts.supplierPayoutCents + amounts.affiliateTransferCents
      expect(out).toBeLessThanOrEqual(l.H)
    }
  })

  it("all amounts are non-negative integers", () => {
    const r = rng(7)
    for (let i = 0; i < N; i++) {
      const { amounts } = pipeline(randomLine(r, { belowWholesale: true }))
      for (const v of [
        amounts.supplierPayoutCents,
        amounts.affiliateTransferCents,
        amounts.supplierFeeCents,
        amounts.affiliateFeeCents,
        amounts.affisellFeeCents,
      ]) {
        expect(Number.isInteger(v) && v >= 0).toBe(true)
      }
    }
  })

  it("the scheduler is idempotent: re-running after its own write-back changes nothing", () => {
    const r = rng(99)
    for (let i = 0; i < N; i++) {
      const l = randomLine(r)
      const p = pipeline(l)
      // Exactly what scheduleMarketplaceTransferAttempts / applyOrderSettlement persist.
      const writtenBack = {
        ...p.order,
        affiliatePayoutCents: p.amounts.affiliateTransferCents,
        supplierPayoutCents: p.amounts.supplierPayoutCents,
      }
      const again = computeTransferAmountsFromOrder(
        orderSplitInputFromOrder(writtenBack, { firstSchedule: false })
      )
      expect(again.affiliateTransferCents).toBe(p.amounts.affiliateTransferCents)
      expect(again.supplierPayoutCents).toBe(p.amounts.supplierPayoutCents)
    }
  })

  it("supplier and affiliate legs share one commission even if the stored commission is 0", () => {
    const r = rng(5)
    for (let i = 0; i < 2_000; i++) {
      const l = randomLine(r)
      if (l.bpsC === 0) continue
      const p = pipeline(l)
      const broken = { ...p.order, commissionCents: 0, affiliatePayoutCents: 0 }
      const input = orderSplitInputFromOrder(broken, { firstSchedule: false })
      expect(input.affiliatePayoutCents).toBe(Math.round((l.W * l.bpsC) / 10_000))
    }
  })

  it("the guard never blocks a healthy sale, even a heavily discounted one (platform-funded)", () => {
    const r = rng(2024)
    let subsidised = 0
    for (let i = 0; i < N; i++) {
      const l = randomLine(r, { belowWholesale: true })
      const { amounts, order } = pipeline(l)
      const out = amounts.supplierPayoutCents + amounts.affiliateTransferCents
      const check = checkTransferBudget({
        lineHtCents: orderTransferCeilingCents(order),
        transferCents: [amounts.supplierPayoutCents, amounts.affiliateTransferCents],
      })
      expect(check.ok).toBe(true)
      if (platformSubsidyCents({ lineHtCents: l.H, payoutsCents: out }) > 0) subsidised += 1
    }
    // Below-wholesale lines really are funded by the platform — surfaced, not blocked.
    expect(subsidised).toBeGreaterThan(0)
  })

  it("the guard blocks the double-count signature (payouts above the undiscounted price)", () => {
    const r = rng(31)
    let blocked = 0
    let inflated = 0
    for (let i = 0; i < 5_000; i++) {
      const l = fixedMarginLine(r)
      const p = pipeline(l)
      const writtenBack = { ...p.order, affiliatePayoutCents: p.amounts.affiliateTransferCents }
      const { commissionCents: _omit, ...legacyRow } = writtenBack
      const legacy = computeTransferAmountsFromOrder(orderSplitInputFromOrder(legacyRow))
      if (legacy.affiliateTransferCents <= p.amounts.affiliateTransferCents) continue
      inflated += 1
      const check = checkTransferBudget({
        lineHtCents: orderTransferCeilingCents(p.order),
        transferCents: [legacy.supplierPayoutCents, legacy.affiliateTransferCents],
      })
      if (!check.ok) blocked += 1
    }
    expect(inflated).toBeGreaterThan(0)
    expect(blocked).toBeGreaterThan(0)
  })

  it("regression: without the stable commission, a re-run double-counts the markup", () => {
    const r = rng(11)
    let inflated = 0
    for (let i = 0; i < 2_000; i++) {
      const l = fixedMarginLine(r)
      const p = pipeline(l)
      const writtenBack = { ...p.order, affiliatePayoutCents: p.amounts.affiliateTransferCents }
      // Legacy behaviour: the row is read without `commissionCents`.
      const { commissionCents: _omit, ...legacyRow } = writtenBack
      const legacy = computeTransferAmountsFromOrder(orderSplitInputFromOrder(legacyRow))
      if (legacy.affiliateTransferCents > p.amounts.affiliateTransferCents) inflated += 1
    }
    expect(inflated).toBeGreaterThan(0)
  })

  it("the production chain equals the canonical model, field by field, for every line", () => {
    const r = rng(777)
    for (let i = 0; i < N; i++) {
      const l = randomLine(r)
      const p = pipeline(l)
      const model = computeSaleSplit({
        wholesaleCents: l.W,
        commissionBps: l.bpsC,
        markupCents: resolveLineMarkupCents({
          collectedHtCents: l.H,
          wholesaleCents: l.W,
          fixedListingMarginCents: l.fixedMarginPerUnit > 0 ? l.fixedMarginPerUnit * l.qty : undefined,
        }),
        supplierFeeBps: supplierFeeBpsForCategory({ categoryBps: l.affisellBps, usesAffisellAutoBuy: l.autoBuy }),
        supplierFeeBaseCents: l.autoBuy ? l.aeWholesale : null,
        collectedHtCents: l.H,
      })
      expect(p.amounts.supplierFeeCents).toBe(model.supplierFeeCents)
      expect(p.amounts.affiliateFeeCents).toBe(model.resellerFeeCents)
      expect(p.amounts.supplierPayoutCents).toBe(model.supplierPayoutCents)
      expect(p.amounts.affiliateTransferCents).toBe(model.resellerPayoutCents)
      expect(p.amounts.affisellFeeCents).toBe(model.platformFeeCents)
    }
  })

  it("charges the category commission on the supplier side and a flat 20 % on the reseller side", () => {
    const r = rng(3)
    for (let i = 0; i < 5_000; i++) {
      const l = randomLine(r)
      const { amounts, order } = pipeline(l)
      const feeBase = l.autoBuy && l.aeWholesale ? l.aeWholesale : l.W
      const bps = l.affisellBps + (l.autoBuy ? 700 : 0)
      expect(amounts.supplierFeeCents).toBe(Math.min(l.W - Math.round((l.W * l.bpsC) / 10_000), Math.round((feeBase * bps) / 10_000)))
      const gross = Math.round((l.W * l.bpsC) / 10_000) + order.affiliateMarginCents
      expect(amounts.affiliateFeeCents).toBe(Math.round((gross * 2000) / 10_000))
    }
  })
})


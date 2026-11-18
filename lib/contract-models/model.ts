/**
 * Chantier 5 — commercial (contract) models, VERSIONED, in DRAFT and SIMULATION only (founder decision 2026-11-18).
 *
 * One common engine, configurable economic rules: every supplier × source relation will point to a model that fixes
 * (1) the FIVE ROLES of a line — payer of the source, owner of the goods, contractual supplier (seller of record),
 * bearer of the source cost, party responsible for delivery and returns — never derived from one another, and
 * (2) the remuneration parameters, from a CLOSED list (no free-form formula is ever evaluated).
 *
 * Nothing here is wired into checkout, settlement or transfers: a model is a value, validated and simulated on past
 * orders. Activating one on a real supplier, and the values of B / C models, are the founder's decisions. Existing
 * orders are never recomputed (no retroactive change): a simulation reports differences, it writes nothing.
 *
 * The split formula of path A is the settlement's own (`unitOutcome`, itself pinned to the real settlement functions):
 *     commission C = round(W × commission bps)         paid to the reseller OUT OF the supplier's price
 *     margin     M = P − W                             the reseller's markup
 *     supplier fee = round(W × supplierFeeBps)         Affisell's fee on the supplier side
 *     reseller fee = round((C + M) × resellerFeeBps)   Affisell's fee on the reseller side
 *     supplier gets W − C − supplier fee · reseller gets C + M − reseller fee · Affisell keeps the two fees
 */

export const CONTRACT_PATHS = ["A_catalogue", "B_platform_purchase", "C1_delegated_purchase", "C2_advanced_purchase"] as const
export type ContractPath = (typeof CONTRACT_PATHS)[number]

export const PARTIES = ["supplier", "affisell", "source", "none"] as const
export type Party = (typeof PARTIES)[number]

export type ContractRoles = {
  /** Whose money leaves to pay the source ("none" = no source purchase: the supplier ships its own stock). */
  payer: Party
  /** Who holds the goods between the source and the buyer. Legal qualification: to validate with counsel. */
  owner: Party
  /** Seller of record towards the buyer (order, invoice, legal notices). */
  contractualSupplier: Party
  /** Whose remuneration is reduced by the source cost. */
  costBearer: Party
  /** Who ships, receives returns and refunds. */
  fulfilmentAndReturns: Party
}

export type ContractParameters = {
  /** Affisell's fee on the supplier side, bps of W. null = the category grid / negotiated rate applies (as today). */
  supplierFeeBps: number | null
  /** Fixed fee per order line on the supplier side, cents (0 = none). */
  supplierFixedFeeCents: number
  /** Affisell's fee on the reseller side, bps of (commission + markup). */
  resellerFeeBps: number
  /** Service fee for a purchase placed by the engine, bps of the SOURCE cost (C1 / C2). */
  procurementServiceFeeBps: number
  /** Who bears shipping, FX and returns costs of the source purchase. */
  shippingBearer: Party
  returnsBearer: Party
  /** C2 only: Affisell advances the source cost. Never allowed without a guarantee rule (founder decision). */
  advance: { allowed: boolean; maxCentsPerLine: number; guarantee: "none" | "deposit" | "deduct_from_payout" }
}

export type ContractModel = {
  /** Stable id of the model family, e.g. "catalogue-standard". */
  id: string
  /** Increases on every change; an order keeps the version of its payment. */
  version: number
  status: "draft" | "active" | "retired"
  path: ContractPath
  label: string
  roles: ContractRoles
  parameters: ContractParameters
  /** Parameters whose value is a founder decision not yet taken (the model can only be simulated). */
  undecided: ReadonlyArray<keyof ContractParameters | "roles.owner" | "roles.contractualSupplier">
}

/** The roles each path allows — a combination outside this table is refused before any purchase. */
export const ALLOWED_ROLES: Record<ContractPath, ContractRoles> = {
  A_catalogue: { payer: "none", owner: "supplier", contractualSupplier: "supplier", costBearer: "supplier", fulfilmentAndReturns: "supplier" },
  B_platform_purchase: { payer: "affisell", owner: "affisell", contractualSupplier: "affisell", costBearer: "affisell", fulfilmentAndReturns: "affisell" },
  C1_delegated_purchase: { payer: "supplier", owner: "supplier", contractualSupplier: "supplier", costBearer: "supplier", fulfilmentAndReturns: "supplier" },
  C2_advanced_purchase: { payer: "affisell", owner: "supplier", contractualSupplier: "supplier", costBearer: "supplier", fulfilmentAndReturns: "supplier" },
}

const bpsOk = (v: number) => Number.isInteger(v) && v >= 0 && v <= 5_000
const centsOk = (v: number) => Number.isInteger(v) && v >= 0

/** Invariants checked BEFORE a model can be stored or simulated. Returns the list of violated rules (empty = valid). */
export function validateContractModel(model: ContractModel): string[] {
  const errors: string[] = []
  if (!model.id.trim()) errors.push("id_required")
  if (!Number.isInteger(model.version) || model.version < 1) errors.push("version_invalid")
  const allowed = ALLOWED_ROLES[model.path]
  if (!allowed) errors.push("path_unknown")
  else {
    for (const key of Object.keys(allowed) as Array<keyof ContractRoles>) {
      if (model.roles[key] !== allowed[key]) errors.push(`role_not_allowed:${key}`)
    }
  }
  const p = model.parameters
  if (p.supplierFeeBps != null && !bpsOk(p.supplierFeeBps)) errors.push("supplier_fee_bps_invalid")
  if (!bpsOk(p.resellerFeeBps)) errors.push("reseller_fee_bps_invalid")
  if (!bpsOk(p.procurementServiceFeeBps)) errors.push("service_fee_bps_invalid")
  if (!centsOk(p.supplierFixedFeeCents)) errors.push("fixed_fee_invalid")
  const buysFromSource = model.path !== "A_catalogue"
  if (!buysFromSource && p.procurementServiceFeeBps > 0) errors.push("service_fee_without_purchase")
  if (model.path === "C2_advanced_purchase") {
    if (!p.advance.allowed) errors.push("advance_required_for_c2")
    else if (p.advance.guarantee === "none") errors.push("advance_without_guarantee")
    if (!centsOk(p.advance.maxCentsPerLine) || p.advance.maxCentsPerLine === 0) errors.push("advance_cap_required")
  } else if (p.advance.allowed) errors.push("advance_only_in_c2")
  if (model.status === "active" && model.undecided.length > 0) errors.push("active_with_undecided_parameters")
  return errors
}

export type LineInput = {
  /** Selling price to the buyer, HT, cents (P). */
  priceHtCents: number
  /** Supplier's catalogue price, cents (W). For path B the platform account's price. */
  wholesaleCents: number
  /** Reseller commission, bps of W. */
  commissionBps: number
  /** Real cost of the source purchase, cents, all in (price + shipping + duties). 0 for path A. */
  sourceCostCents: number
  /** Supplier fee rate when the model leaves it to the grid (`supplierFeeBps: null`). */
  gridSupplierFeeBps: number
}

export type LineSplit = {
  /** Transfer to the supplier (never negative; a shortfall is reported, not hidden). */
  supplierTransferCents: number
  resellerTransferCents: number
  /** What Affisell keeps before the Stripe fee: fees + (B) its revenue − (B / C2) the source it paid. */
  affisellNetBeforeStripeCents: number
  /** Cash Affisell pays out to the source for this line (B, C2). */
  affisellPaysSourceCents: number
  /** C2: the part of the advance the supplier's share could not cover (to be guaranteed). */
  uncoveredAdvanceCents: number
  /** How many times the source cost is deducted from someone's money (must be exactly 1 when there is a source). */
  sourceCostDeductions: number
}

/**
 * The split of one line under a model. Pure, integer cents. Every path satisfies:
 *   supplier + reseller + Affisell (before Stripe) + source paid = P    (money conservation)
 *   the source cost is paid once and deducted once.
 */
export function splitLine(model: ContractModel, line: LineInput): LineSplit {
  const P = Math.max(0, Math.round(line.priceHtCents))
  const W = Math.max(0, Math.round(line.wholesaleCents))
  const S = Math.max(0, Math.round(line.sourceCostCents))
  const C = Math.round((W * line.commissionBps) / 10_000)
  const M = Math.max(0, P - W)
  const p = model.parameters
  const supplierFeeBps = p.supplierFeeBps ?? line.gridSupplierFeeBps
  const supplierFee = Math.round((W * supplierFeeBps) / 10_000) + p.supplierFixedFeeCents
  const resellerFee = Math.round(((C + M) * p.resellerFeeBps) / 10_000)
  const resellerTransfer = C + M - resellerFee
  const serviceFee = Math.round((S * p.procurementServiceFeeBps) / 10_000)

  switch (model.path) {
    case "A_catalogue":
      return {
        supplierTransferCents: W - C - supplierFee,
        resellerTransferCents: resellerTransfer,
        affisellNetBeforeStripeCents: supplierFee + resellerFee,
        affisellPaysSourceCents: 0,
        uncoveredAdvanceCents: 0,
        sourceCostDeductions: 0,
      }
    case "B_platform_purchase":
      // Affisell is the supplier: no supplier transfer, the "supplier share" is Affisell's revenue, it pays the source.
      return {
        supplierTransferCents: 0,
        resellerTransferCents: resellerTransfer,
        affisellNetBeforeStripeCents: W - C + resellerFee - S,
        affisellPaysSourceCents: S,
        uncoveredAdvanceCents: 0,
        sourceCostDeductions: S > 0 ? 1 : 0,
      }
    case "C1_delegated_purchase":
      // The supplier pays its source itself: transfer as in A, minus the engine's service fee.
      return {
        supplierTransferCents: W - C - supplierFee - serviceFee,
        resellerTransferCents: resellerTransfer,
        affisellNetBeforeStripeCents: supplierFee + resellerFee + serviceFee,
        affisellPaysSourceCents: 0,
        uncoveredAdvanceCents: 0,
        sourceCostDeductions: S > 0 ? 1 : 0,
      }
    case "C2_advanced_purchase": {
      // Affisell pays the source and recovers it from the supplier's share, once.
      const share = W - C - supplierFee - serviceFee
      const recovered = Math.min(Math.max(0, share), S)
      return {
        supplierTransferCents: Math.max(0, share - S),
        resellerTransferCents: resellerTransfer,
        affisellNetBeforeStripeCents: supplierFee + resellerFee + serviceFee - (S - recovered),
        affisellPaysSourceCents: S,
        uncoveredAdvanceCents: S - recovered,
        sourceCostDeductions: S > 0 ? 1 : 0,
      }
    }
  }
}

/**
 * Money conservation: supplier + reseller + Affisell (before Stripe) + source paid = P. Holds on every path as long as
 * the supplier's share before the source (W − C − fees) is not negative; in C2 a share smaller than the source cost
 * leaves `uncoveredAdvanceCents` as Affisell's exposure (already inside its net), the identity still holds.
 */
export function splitConserves(line: LineInput, split: LineSplit): boolean {
  const P = Math.max(0, Math.round(line.priceHtCents))
  return (
    split.supplierTransferCents + split.resellerTransferCents + split.affisellNetBeforeStripeCents + split.affisellPaysSourceCents === P
  )
}

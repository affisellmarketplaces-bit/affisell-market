/**
 * « Technically ready » vs « really sellable » (founder brief 2026-11-23 §3). A product can pass every rule of its
 * sheet and still sell little. This module PLACES side by side, never mixes and never scores, six dimensions of ONE
 * product, each read from an existing source with its own qualification:
 *
 *  - `technique`               the sheet's rules (commercial-readiness engine, stock and Affisell holds left to
 *                              `disponibilite`) — `affisell`;
 *  - `offre`                   sheet elements missing that, on Affisell, go with more sales (positive marketplace
 *                              association only; none established = `inconnu`) — `calcul`;
 *  - `disponibilite`           can a buyer buy it now and for a while (readiness stock / hold findings + the catalogue
 *                              health's availability diagnoses) — `fiche` / `affisell` / `calcul`;
 *  - `rentabilite_revendeur`   what a reseller is paid per sale at the price Affisell suggests to resellers (supplier
 *                              price + 30 %, standard reseller fee) — the reseller copilot's OWN calculation and its OWN
 *                              « low net » threshold, so the supplier sees exactly what resellers are shown — `calcul`;
 *  - `demande`                 distribution: resellers listing it (catalogue health « no reseller after 14 days ») — `observe`;
 *  - `performance`             paid orders while listed (catalogue health « listed, no sale in 30 days ») — `observe`.
 *
 * Each dimension is `ok`, `faible`, `inconnu` (not enough data / too early — never guessed) or `non_applicable`. The
 * headline is a RULE, never a weighted number: not technically ready → `pas_pret`; ready with ≥ 1 weak dimension →
 * `pret_peu_attractif` (the weak ones, in cause → effect order); ready with nothing weak but something unknown →
 * `pret_a_observer`; else `pret_sans_signal_faible` (never « will sell »). The only link stated between dimensions is a
 * MECHANISM Affisell itself applies: a low reseller net is flagged « à vérifier » to resellers by the copilot.
 * Associations are associations; nothing here is a forecast or a promise. Pure, client-safe.
 */
import type { ReadinessFinding, ReadinessReport } from "@/lib/commercial-readiness/readiness"
import type { QualityFeature } from "@/lib/listing-quality/quality-effect"
import { computeResellerNetPerSale } from "@/lib/reseller-copilot/net-per-sale"
import { LOW_NET_CENTS, suggestedPriceHt } from "@/lib/reseller-copilot/selection"

export type StandingDimension = "technique" | "offre" | "disponibilite" | "rentabilite_revendeur" | "demande" | "performance"
export type DimensionState = "ok" | "faible" | "inconnu" | "non_applicable"
export type DimensionReading = {
  dimension: StandingDimension
  state: DimensionState
  qualification: "affisell" | "fiche" | "calcul" | "observe"
  /** Short code of what decides the state (texts are the reader's). */
  reason: string
  evidence: Record<string, number | string | boolean | null>
}
export type StandingHeadline = "pas_pret" | "pret_peu_attractif" | "pret_a_observer" | "pret_sans_signal_faible"
export type CommercialStanding = {
  headline: StandingHeadline
  dimensions: DimensionReading[]
  /** Weak dimensions, cause before effect. */
  weak: StandingDimension[]
  /** True when a low reseller net is shown to resellers as « à vérifier » by the copilot (a mechanism, not an inference). */
  copilotFlagsLowNet: boolean
}

export type StandingInput = {
  readiness: ReadinessReport
  /** Catalogue-health codes diagnosed on THIS product (same report, never re-judged here). */
  healthCodes: ReadonlySet<string>
  basePriceCents: number
  /** Explicit commission % (0 when none). */
  commissionRatePct: number
  commissionExplicit: boolean
  /** Published (not a draft). */
  published: boolean
  /** Published, active and not held. */
  onSale: boolean
  ageDays: number
  resellersListing: number
  paidOrders30d: number
}

/** Same windows as the catalogue health (no reseller after 14 days, no sale over 30 days). */
export const STANDING_NO_RESELLER_DAYS = 14
export const STANDING_NO_SALES_DAYS = 30

const CAUSE_ORDER: StandingDimension[] = ["disponibilite", "rentabilite_revendeur", "offre", "demande", "performance"]
const AVAILABILITY_HEALTH_CODES = ["out_of_stock", "stock_unconfirmed", "held_by_affisell", "paused_but_listed", "low_stock", "stock_cover_short", "variant_stock_untracked"] as const
const AVAILABILITY_FINDINGS = new Set(["stock_missing", "stock_unconfirmed", "stock_low", "held_by_affisell", "hold_unverifiable"])

/** Readiness findings that belong to availability, not to the sheet's technical rules. */
export function isAvailabilityFinding(f: Pick<ReadinessFinding, "code">): boolean {
  return AVAILABILITY_FINDINGS.has(f.code)
}

export function assessCommercialStanding(i: StandingInput): CommercialStanding {
  const dims: DimensionReading[] = []
  const technicalBlockers = i.readiness.findings.filter((f) => f.level === "bloquant" && !isAvailabilityFinding(f))
  const technicallyReady = technicalBlockers.length === 0
  dims.push({
    dimension: "technique",
    state: technicallyReady ? "ok" : "faible",
    qualification: "affisell",
    reason: technicallyReady ? "rules_met" : "rules_unmet",
    evidence: { blocking: technicalBlockers.length, firstBlocking: technicalBlockers[0]?.code ?? null },
  })

  // Offer quality: only elements with an ESTABLISHED association count; without any, the dimension is unknown.
  const recommended = i.readiness.findings.filter((f) => f.level === "recommande" && f.feature)
  const measured = recommended.filter((f) => f.evidence)
  if (measured.length > 0) {
    dims.push({
      dimension: "offre",
      state: "faible",
      qualification: "calcul",
      reason: "measured_elements_missing",
      evidence: { missing: measured.map((f) => f.feature as QualityFeature).join(","), count: measured.length, bestLo: Math.max(...measured.map((f) => f.evidence!.lo)) },
    })
  } else {
    dims.push({
      dimension: "offre",
      state: recommended.length === 0 ? "ok" : "inconnu",
      qualification: "calcul",
      reason: recommended.length === 0 ? "sheet_complete" : "no_established_association",
      evidence: { missingUnmeasured: recommended.length },
    })
  }

  // Availability: the readiness stock / hold findings and the health's availability diagnoses, as they are.
  const availFindings = i.readiness.findings.filter(isAvailabilityFinding).map((f) => f.code)
  const availHealth = AVAILABILITY_HEALTH_CODES.filter((c) => i.healthCodes.has(c))
  const availCodes = [...new Set([...availFindings, ...availHealth])]
  const stockUnknown = i.healthCodes.has("variant_stock_untracked") && availCodes.length === 1
  dims.push({
    dimension: "disponibilite",
    state: availCodes.length === 0 ? "ok" : stockUnknown ? "inconnu" : "faible",
    qualification: availHealth.includes("stock_cover_short") ? "calcul" : availCodes.some((c) => c.includes("held") || c.includes("hold")) ? "affisell" : "fiche",
    reason: availCodes[0] ?? "available",
    evidence: { codes: availCodes.join(",") },
  })

  // Reseller profitability, at the price the copilot suggests to resellers, with its own threshold.
  let copilotFlagsLowNet = false
  if (!i.commissionExplicit || i.basePriceCents <= 0) {
    dims.push({ dimension: "rentabilite_revendeur", state: "inconnu", qualification: "calcul", reason: "terms_incomplete", evidence: {} })
  } else {
    const suggested = suggestedPriceHt(i.basePriceCents)
    const net = computeResellerNetPerSale({ supplierPriceCents: i.basePriceCents, commissionRatePct: i.commissionRatePct, sellingPriceHtCents: suggested, affiliateFeeBps: null })
    copilotFlagsLowNet = net.netCents < LOW_NET_CENTS
    dims.push({
      dimension: "rentabilite_revendeur",
      state: copilotFlagsLowNet ? "faible" : "ok",
      qualification: "calcul",
      reason: copilotFlagsLowNet ? "low_net_per_sale" : "net_per_sale_ok",
      evidence: {
        netCents: net.netCents,
        suggestedPriceHtCents: suggested,
        commissionCents: net.commissionCents,
        markupCents: net.markupCents,
        feeBps: net.feeBps,
        thresholdCents: LOW_NET_CENTS,
      },
    })
  }

  // Distribution and measured performance only mean something once the product is on sale long enough.
  if (!i.published) {
    dims.push({ dimension: "demande", state: "non_applicable", qualification: "observe", reason: "not_published", evidence: {} })
    dims.push({ dimension: "performance", state: "non_applicable", qualification: "observe", reason: "not_published", evidence: {} })
  } else {
    const noReseller = i.healthCodes.has("no_reseller")
    dims.push({
      dimension: "demande",
      state: i.resellersListing > 0 ? "ok" : noReseller ? "faible" : "inconnu",
      qualification: "observe",
      reason: i.resellersListing > 0 ? "listed_by_resellers" : noReseller ? "no_reseller" : i.onSale ? "too_early" : "not_on_sale",
      evidence: { resellersListing: i.resellersListing, ageDays: i.ageDays, windowDays: STANDING_NO_RESELLER_DAYS },
    })
    const noSales = i.healthCodes.has("listed_no_sales")
    dims.push({
      dimension: "performance",
      state: i.paidOrders30d > 0 ? "ok" : noSales ? "faible" : "inconnu",
      qualification: "observe",
      reason: i.paidOrders30d > 0 ? "sells" : noSales ? "listed_no_sales" : i.resellersListing === 0 ? "not_distributed" : "too_early",
      evidence: { paidOrders30d: i.paidOrders30d, resellersListing: i.resellersListing, windowDays: STANDING_NO_SALES_DAYS },
    })
  }

  const weak = CAUSE_ORDER.filter((d) => dims.some((r) => r.dimension === d && r.state === "faible"))
  const unknown = dims.some((r) => r.dimension !== "technique" && r.state === "inconnu")
  const headline: StandingHeadline = !technicallyReady ? "pas_pret" : weak.length > 0 ? "pret_peu_attractif" : unknown ? "pret_a_observer" : "pret_sans_signal_faible"
  return { headline, dimensions: dims, weak, copilotFlagsLowNet }
}

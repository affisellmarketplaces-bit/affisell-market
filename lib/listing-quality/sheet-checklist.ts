/**
 * Live sheet checklist for a supplier writing a product sheet (portfolio row 30, 2026-11-23). Pure, client-safe.
 *
 * Same 12 elements and same rules as the sheet-quality measure (`featureValue` over `sheetSignals`), so what the form
 * says « missing » is exactly what the measure would read once the sheet is live. Wording rule (founder, 2026-11-23):
 * an element carries a figure ONLY when the marketplace aggregate established a positive association for it; the
 * others are stated as facts (present / missing) with no sales claim, and no gain is ever computed.
 */
import { featureValue, QUALITY_FEATURES, type QualityFeature, type QualityProduct } from "@/lib/listing-quality/quality-effect"
import type { SheetSignals } from "@/lib/listing-quality/sheet-facts"

export type QualityEvidence = { feature: QualityFeature; adjustedRatio: number; lo: number }

export type ChecklistItem = {
  feature: QualityFeature
  state: "present" | "missing" | "not_applicable"
  /** Marketplace aggregate (association, not a cause) — only for an established positive association. */
  evidence: { ratio: number; lo: number } | null
}

export type SheetChecklist = {
  items: ChecklistItem[]
  present: number
  /** Elements that apply to this sheet. */
  applicable: number
  missingWithEvidence: number
}

/** Order: missing with evidence (strongest lower bound first), then missing, then present, then not applicable. */
export function buildSheetChecklist(signals: SheetSignals, evidence: readonly QualityEvidence[] = []): SheetChecklist {
  const product: QualityProduct = { id: "", supplierId: "", rootCategoryId: null, basePriceCents: 0, createdAt: new Date(0), ...signals }
  const ev = new Map(evidence.filter((e) => Number.isFinite(e.lo) && e.lo > 1 && Number.isFinite(e.adjustedRatio)).map((e) => [e.feature, e]))
  const items: ChecklistItem[] = QUALITY_FEATURES.map((feature) => {
    const v = featureValue(feature, product)
    const e = ev.get(feature)
    return {
      feature,
      state: v === null ? "not_applicable" : v ? "present" : "missing",
      evidence: e ? { ratio: Math.round(e.adjustedRatio * 10) / 10, lo: Math.round(e.lo * 10) / 10 } : null,
    }
  })
  const rank = (i: ChecklistItem) => (i.state === "missing" ? (i.evidence ? 0 : 1) : i.state === "present" ? 2 : 3)
  items.sort((a, b) => rank(a) - rank(b) || (b.evidence?.lo ?? 0) - (a.evidence?.lo ?? 0))
  const applicable = items.filter((i) => i.state !== "not_applicable").length
  return {
    items,
    present: items.filter((i) => i.state === "present").length,
    applicable,
    missingWithEvidence: items.filter((i) => i.state === "missing" && i.evidence).length,
  }
}

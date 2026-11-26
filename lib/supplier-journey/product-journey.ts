/**
 * Where ONE product stands on its way from creation to sale, for its supplier (founder priority 2026-11-19:
 * Fournisseur → Catalogue → Revendeur → Acheteur → Commande). Pure: the caller passes facts already read; nothing is
 * guessed. Each step says `done`, `todo` (an action of the supplier), `blocked` (Affisell holds it — the supplier can
 * not act), `waiting` (depends on others: resellers, buyers) or `optional`.
 *
 * The supply-cost step is OPTIONAL and confidential: it never conditions publication, price or commission.
 */
export type JourneyStepId = "sheet" | "safety" | "stock" | "commission" | "publication" | "resellers" | "sales" | "costs"
export type JourneyStatus = "done" | "todo" | "blocked" | "waiting" | "optional"
export type JourneyStep = { id: JourneyStepId; status: JourneyStatus; detail: string | null }

export type JourneyFacts = {
  name: string
  imageCount: number
  hasCategory: boolean
  /** Product-safety data complete (null = not applicable: digital goods). */
  safetyReady: boolean | null
  safetyMissing: string[]
  /** Units available (sum of variant rows when the stock lives there). */
  availableUnits: number
  commissionRate: number
  isDraft: boolean
  active: boolean
  /** Affisell hold (recall / suspension / unverifiable), null when none. */
  hold: string | null
  listedByResellers: number
  paidOrders30d: number
  costDeclared: boolean
  costQualification: string | null
}

export function buildProductJourney(f: JourneyFacts): JourneyStep[] {
  const sheetMissing = [
    ...(f.name.trim() ? [] : ["name"]),
    ...(f.imageCount > 0 ? [] : ["photo"]),
    ...(f.hasCategory ? [] : ["category"]),
  ]
  const onSale = !f.isDraft && f.active && !f.hold
  return [
    { id: "sheet", status: sheetMissing.length === 0 ? "done" : "todo", detail: sheetMissing.join(",") || null },
    {
      id: "safety",
      status: f.safetyReady === null || f.safetyReady ? "done" : "todo",
      detail: f.safetyReady === false ? f.safetyMissing.join(",") : null,
    },
    { id: "stock", status: f.availableUnits > 0 ? "done" : "todo", detail: String(Math.max(0, f.availableUnits)) },
    { id: "commission", status: f.commissionRate > 0 ? "done" : "todo", detail: f.commissionRate > 0 ? String(f.commissionRate) : null },
    {
      id: "publication",
      status: f.hold ? "blocked" : onSale ? "done" : "todo",
      detail: f.hold ?? (f.isDraft ? "draft" : f.active ? null : "paused"),
    },
    { id: "resellers", status: f.listedByResellers > 0 ? "done" : onSale ? "waiting" : "todo", detail: String(f.listedByResellers) },
    { id: "sales", status: f.paidOrders30d > 0 ? "done" : "waiting", detail: String(f.paidOrders30d) },
    { id: "costs", status: f.costDeclared ? "done" : "optional", detail: f.costQualification },
  ]
}

/** The first thing the supplier can do now (blocked / waiting steps are not actions). Null when nothing is left to do. */
export function nextSupplierAction(steps: ReadonlyArray<JourneyStep>): JourneyStepId | null {
  return steps.find((s) => s.status === "todo")?.id ?? null
}

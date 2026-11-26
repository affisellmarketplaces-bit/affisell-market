/**
 * Commercial readiness of SAVED products (2026-11-23): the forms' engine on the stored row, with the rules of the
 * product's stage — a live product never gets a fake refusal, nothing is ever withdrawn, an Affisell hold is never the
 * supplier's fix — and the same verdict before and after saving (body ↔ stored parity), consistent with the catalogue
 * health on every shared diagnosis. Plus « technically ready vs really sellable » and the next best action.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { buildCatalogReadiness, summarizeProductReadiness, type CatalogReadinessContext, type CatalogReadinessProduct } from "@/lib/commercial-readiness/catalog-readiness"
import { assessCommercialStanding } from "@/lib/commercial-readiness/commercial-standing"
import { assessCommercialReadiness, type ReadinessFinding } from "@/lib/commercial-readiness/readiness"
import { assessStoredProductReadiness, type StoredReadinessRow } from "@/lib/commercial-readiness/stored-readiness"
import { supplierNextActions } from "@/lib/next-best-action/next-best-action"
import { LOW_NET_CENTS } from "@/lib/reseller-copilot/selection"
import { buildHealthReport, diagnoseProduct, type HealthProduct } from "@/lib/supplier-catalog-health/diagnose"

const GPSR_OK = [
  { key: "gpsr_manufacturer_name", value: "Lumo SAS" },
  { key: "gpsr_manufacturer_address", value: "1 rue de Lyon, 13001 Marseille" },
  { key: "gpsr_manufacturer_email", value: "contact@lumo.fr" },
  { key: "gpsr_manufacturer_country", value: "FR" },
]
const RESERVED = [...GPSR_OK, { key: "brand", value: "Lumo" }, { key: "ean", value: "4006381333931" }, { key: "return_window_days", value: "30" }]
const SPECS = [
  { key: "matiere", value: "Aluminium" },
  { key: "puissance", value: "8 W" },
  { key: "couleur", value: "Noir" },
]
const IMAGES = ["a", "b", "c", "d", "e"].map((x) => `https://cdn.affisell.com/${x}.jpg`)
const DESCRIPTION = "<p>" + "Lampe LED pliable, trois intensités, port USB-C, bras orientable. ".repeat(4) + "</p>"

const row = (over: Partial<StoredReadinessRow> = {}): StoredReadinessRow => ({
  name: "Lampe de bureau LED pliable aluminium",
  description: DESCRIPTION,
  images: IMAGES,
  categoryId: "cat-leaf",
  listingKind: "PHYSICAL",
  basePriceCents: 3990,
  offerMode: "STANDARD",
  commissionRate: 15,
  variants: null,
  customColumns: null,
  stock: 25,
  hasVariants: false,
  warehouseType: "local",
  deliveryCountryCodes: ["FR", "BE"],
  deliveryMin: 2,
  deliveryMax: 4,
  isDraft: false,
  attributes: RESERVED,
  specCount: SPECS.length,
  ...over,
})

/** The body the classic form sends for the same sheet. */
const bodyOf = (r: StoredReadinessRow): Record<string, unknown> => ({
  name: r.name,
  description: r.description,
  price: r.basePriceCents / 100,
  stock: r.stock,
  categoryId: r.categoryId,
  images: r.images,
  listingKind: r.listingKind,
  commission: r.commissionRate,
  offerMode: r.offerMode,
  warehouseType: r.warehouseType,
  deliveryCountryCodes: r.deliveryCountryCodes,
  deliveryMin: r.deliveryMin,
  deliveryMax: r.deliveryMax,
  productAttributes: [...r.attributes, ...SPECS],
})

const codes = (r: { findings: ReadinessFinding[] }) => r.findings.map((f) => f.code).sort()
const find = (r: { findings: ReadinessFinding[] }, code: string) => r.findings.find((f) => f.code === code)
const CTX = { listingReadinessMode: "warn" as const, supplierFeeBps: 1000 }

describe("stage: what the server really does to a product already on sale", () => {
  it("a complete live product is « prêt »", () => {
    expect(assessStoredProductReadiness(row(), { ...CTX, holds: [] }).verdict).toBe("pret")
  })
  it("rules checked only when a product GOES live are priorities once it is on sale, refusals for a draft", () => {
    for (const [over, code] of [
      [{ images: [] }, "photo_missing"],
      [{ categoryId: null }, "category_missing"],
      [{ warehouseType: null }, "warehouse_missing"],
      [{ deliveryCountryCodes: [] }, "delivery_countries_missing"],
    ] as const) {
      const live = find(assessStoredProductReadiness(row(over as Partial<StoredReadinessRow>), { ...CTX, holds: [] }), code)!
      expect(live, code).toMatchObject({ level: "prioritaire", prevents: null, basis: "publication_rule_live", live: true })
      const draft = find(assessStoredProductReadiness(row({ ...(over as Partial<StoredReadinessRow>), isDraft: true }), { ...CTX, holds: [] }), code)!
      expect(draft, code).toMatchObject({ level: "bloquant", prevents: "publication", basis: "server_refusal" })
      expect(draft.live).toBeUndefined()
    }
  })
  it("name and price are checked at every save of a live product: the save is refused, the product stays on sale", () => {
    const r = assessStoredProductReadiness(row({ basePriceCents: 0 }), { ...CTX, holds: [] })
    expect(find(r, "price_missing")).toMatchObject({ level: "bloquant", prevents: "save", basis: "save_refusal", live: true })
  })
  it("a live product without an explicit commission can not produce an order: blocks the SALE", () => {
    const r = assessStoredProductReadiness(row({ commissionRate: 0 }), { ...CTX, holds: [] })
    expect(find(r, "commission_not_explicit")).toMatchObject({ level: "bloquant", prevents: "sale", basis: "not_buyable" })
  })
  it("account rules (merchant verification, catalogue cap) never apply to a product already live", () => {
    const live = assessStoredProductReadiness(row(), { ...CTX, holds: [], merchantVerified: false, catalogCapReached: true })
    expect(codes(live)).not.toContain("merchant_unverified")
    expect(codes(live)).not.toContain("catalog_cap_reached")
    const draft = assessStoredProductReadiness(row({ isDraft: true }), { ...CTX, holds: [], merchantVerified: false, catalogCapReached: true })
    expect(codes(draft)).toEqual(expect.arrayContaining(["merchant_unverified", "catalog_cap_reached"]))
  })
  it("product safety never blocks a live product, even in enforce; it blocks a draft only in enforce", () => {
    const attrs = RESERVED.filter((a) => !a.key.startsWith("gpsr_"))
    expect(find(assessStoredProductReadiness(row({ attributes: attrs }), { ...CTX, listingReadinessMode: "enforce", holds: [] }), "safety_incomplete")).toMatchObject({ level: "prioritaire", prevents: null })
    expect(find(assessStoredProductReadiness(row({ attributes: attrs, isDraft: true }), { ...CTX, listingReadinessMode: "enforce", holds: [] }), "safety_incomplete")).toMatchObject({ level: "bloquant", prevents: "publication" })
    expect(find(assessStoredProductReadiness(row({ attributes: attrs, isDraft: true }), { ...CTX, holds: [] }), "safety_incomplete")!.level).toBe("prioritaire")
  })
  it("what a stored row can not tell is never judged: delivery default, category fields", () => {
    const r = assessStoredProductReadiness(row({ deliveryMin: 2, deliveryMax: 5, isDraft: true }), { ...CTX, holds: [] })
    expect(codes(r)).not.toContain("delivery_time_default")
    expect(codes(r)).not.toContain("category_fields_missing")
  })
})

describe("availability and Affisell holds", () => {
  it("an Affisell hold blocks the sale but is never the next fix", () => {
    const r = assessStoredProductReadiness(row({ images: [] }), { ...CTX, holds: ["product_recalled"] })
    expect(find(r, "held_by_affisell")).toMatchObject({ level: "bloquant", prevents: "sale", fixable: false })
    expect(r.verdict).toBe("bloquant")
    expect(r.nextFix?.code).toBe("photo_missing")
    expect(assessStoredProductReadiness(row(), { ...CTX, holds: ["product_suspended"] }).nextFix).toBeNull()
  })
  it("unreadable holds = « not verifiable », never « no hold »", () => {
    const r = assessStoredProductReadiness(row(), { ...CTX, holds: null })
    expect(find(r, "hold_unverifiable")).toMatchObject({ level: "prioritaire", fixable: false })
    expect(r.verdict).toBe("a_corriger")
  })
  it("an import without a confirmed quantity is said as such, not as « sold out »", () => {
    const attrs = [...RESERVED, { key: "stock_unconfirmed", value: "1" }]
    const draft = assessStoredProductReadiness(row({ attributes: attrs, stock: 0, isDraft: true }), { ...CTX, holds: [] })
    expect(find(draft, "stock_unconfirmed")).toMatchObject({ level: "bloquant", prevents: "publication" })
    expect(codes(draft)).not.toContain("stock_missing")
  })
  it("variants only in the separate table: the quantity is unknown, never judged sold out", () => {
    const r = assessStoredProductReadiness(row({ hasVariants: true, stock: 0 }), { ...CTX, holds: [] })
    expect(codes(r)).not.toContain("stock_missing")
  })
  it("SKU rows: the declared quantity is their sum (same rule as the catalogue health)", () => {
    const variants = { variantRows: [{ name: "Noir", stock: 0 }, { name: "Blanc", stock: 0 }] }
    expect(codes(assessStoredProductReadiness(row({ variants, stock: 12 }), { ...CTX, holds: [] }))).toContain("stock_missing")
  })
})

describe("one source of truth", () => {
  it("before and after saving: the form body and the stored row give the same findings (draft stage)", () => {
    const cases: Array<Partial<StoredReadinessRow>> = [
      {},
      { images: IMAGES.slice(0, 1) },
      { description: "<p>Court.</p>" },
      { commissionRate: 0 },
      { stock: 2 },
      { stock: 0 },
      { warehouseType: null },
      { deliveryCountryCodes: [] },
      { attributes: RESERVED.filter((a) => a.key !== "brand") },
      { attributes: RESERVED.filter((a) => !a.key.startsWith("gpsr_")) },
      { name: "Lampe" },
      { basePriceCents: 120, commissionRate: 60 },
    ]
    for (const over of cases) {
      const stored = row({ ...over, isDraft: true })
      const ctx = { ...CTX, stage: "draft" as const, holds: [] as [] }
      expect(codes(assessStoredProductReadiness(stored, ctx)), JSON.stringify(over)).toEqual(codes(assessCommercialReadiness(bodyOf(stored), ctx)))
    }
  })

  it("agrees with the catalogue health on every diagnosis both make", () => {
    const now = new Date("2026-11-23T12:00:00Z")
    let checked = 0
    for (const isDraft of [false, true])
      for (const price of [0, 3990])
        for (const commission of [0, 15])
          for (const stock of [0, 2, 25])
            for (const unconfirmed of [false, true])
              for (const holds of [[], ["product_recalled"]] as const) {
                const attrs = unconfirmed ? [...RESERVED, { key: "stock_unconfirmed", value: "1" }] : RESERVED
                const r = assessStoredProductReadiness(row({ isDraft, basePriceCents: price, commissionRate: commission, stock, attributes: attrs }), { ...CTX, holds: [...holds] })
                const hp: HealthProduct = {
                  id: "p",
                  name: "Lampe",
                  isDraft,
                  active: true,
                  listingKind: "PHYSICAL",
                  basePriceCents: price,
                  stock,
                  hasVariants: false,
                  variantRowStocks: null,
                  stockUnconfirmed: unconfirmed,
                  commissionExplicit: commission > 0,
                  imageCount: 5,
                  descriptionLength: 300,
                  categoryId: "c",
                  hasGtin: true,
                  deliveryMin: 2,
                  deliveryMax: 4,
                  safetyBlocking: [],
                  holds: [...holds],
                  paidOrders30d: 0,
                  resellersListing: 0,
                  createdAt: now,
                }
                const h = new Set(diagnoseProduct(hp, { now, readinessMode: "warn" }).map((i) => i.code))
                const c = new Set(codes(r))
                expect(c.has("price_missing"), "price").toBe(h.has("price_missing"))
                expect(c.has("stock_unconfirmed"), "unconfirmed").toBe(h.has("stock_unconfirmed"))
                expect(c.has("held_by_affisell"), "held").toBe(h.has("held_by_affisell"))
                // The health reports a missing commission on PUBLISHED products only; the engine on drafts too (publication refusal).
                if (!isDraft) expect(c.has("commission_not_explicit"), "commission").toBe(h.has("commission_not_explicit"))
                // « Sold out » on sale = health out_of_stock (on sale = published, active, not held).
                if (!isDraft && holds.length === 0) expect(c.has("stock_missing"), "stock").toBe(h.has("out_of_stock"))
                checked++
              }
    expect(checked).toBe(96)
  })

  it("the engine stays client-safe; the stored path reuses the shared definitions", () => {
    const stored = readFileSync(join(process.cwd(), "lib/commercial-readiness/stored-readiness.ts"), "utf8")
    for (const fn of ["sheetSignals", "declaredAvailability", "productHasExplicitSupplierCommission", "assessReadinessInput"]) expect(stored, fn).toContain(fn)
    for (const f of ["stored-readiness.ts", "commercial-standing.ts", "catalog-readiness.ts", "readiness.ts"]) {
      expect(readFileSync(join(process.cwd(), "lib/commercial-readiness", f), "utf8"), f).not.toMatch(/@\/lib\/prisma|server-only|i18n-pick-message/)
    }
  })
})

describe("technically ready vs really sellable", () => {
  const standing = (over: Partial<Parameters<typeof assessCommercialStanding>[0]> = {}, r = row()) =>
    assessCommercialStanding({
      readiness: assessStoredProductReadiness(r, { ...CTX, holds: [] }),
      healthCodes: new Set(),
      basePriceCents: r.basePriceCents,
      commissionRatePct: Number(r.commissionRate),
      commissionExplicit: Number(r.commissionRate) > 0,
      published: !r.isDraft,
      onSale: !r.isDraft,
      ageDays: 40,
      resellersListing: 3,
      paidOrders30d: 4,
      ...over,
    })
  it("no score, six separate dimensions, each with its qualification", () => {
    const s = standing()
    expect(s.dimensions.map((d) => d.dimension)).toEqual(["technique", "offre", "disponibilite", "rentabilite_revendeur", "demande", "performance"])
    expect(JSON.stringify(s)).not.toMatch(/score/i)
    expect(s.headline).toBe("pret_sans_signal_faible")
  })
  it("ready but a low reseller net — the copilot's own calculation and threshold", () => {
    const r = row({ basePriceCents: 500, commissionRate: 5 })
    const s = standing({}, r)
    expect(s.headline).toBe("pret_peu_attractif")
    expect(s.weak).toContain("rentabilite_revendeur")
    expect(s.copilotFlagsLowNet).toBe(true)
    const d = s.dimensions.find((x) => x.dimension === "rentabilite_revendeur")!
    expect(d.evidence.thresholdCents).toBe(LOW_NET_CENTS)
    expect(Number(d.evidence.netCents)).toBeLessThan(LOW_NET_CENTS)
  })
  it("distribution and performance come from the catalogue health's own observations", () => {
    const s = standing({ healthCodes: new Set(["no_reseller"]), resellersListing: 0, paidOrders30d: 0 })
    expect(s.weak).toEqual(["demande"])
    const s2 = standing({ healthCodes: new Set(["listed_no_sales"]), resellersListing: 2, paidOrders30d: 0 })
    expect(s2.weak).toEqual(["performance"])
  })
  it("too early = unknown, never weak; a draft has no demand or performance to judge", () => {
    expect(standing({ resellersListing: 0, paidOrders30d: 0, ageDays: 3 }).headline).toBe("pret_a_observer")
    const draft = standing({ published: false, onSale: false }, row({ isDraft: true }))
    expect(draft.dimensions.find((d) => d.dimension === "demande")!.state).toBe("non_applicable")
  })
  it("offer quality is weak only on an ESTABLISHED association; without one it is unknown", () => {
    const r = row({ images: IMAGES.slice(0, 1) })
    const without = assessCommercialStanding({ ...base(r), readiness: assessStoredProductReadiness(r, { ...CTX, holds: [] }) })
    expect(without.dimensions.find((d) => d.dimension === "offre")!.state).toBe("inconnu")
    const withEvidence = assessCommercialStanding({ ...base(r), readiness: assessStoredProductReadiness(r, { ...CTX, holds: [], evidence: [{ feature: "photos_3plus", adjustedRatio: 1.6, lo: 1.2 }] }) })
    expect(withEvidence.dimensions.find((d) => d.dimension === "offre")!.state).toBe("faible")
  })
  it("a sheet that breaks a rule is « pas prêt » whatever sells", () => {
    expect(standing({}, row({ isDraft: true, images: [] })).headline).toBe("pas_pret")
  })
  function base(r: StoredReadinessRow) {
    return { healthCodes: new Set<string>(), basePriceCents: r.basePriceCents, commissionRatePct: 15, commissionExplicit: true, published: true, onSale: true, ageDays: 40, resellersListing: 3, paidOrders30d: 4 }
  }
})

describe("catalogue lists and next best action", () => {
  const ctx: CatalogReadinessContext = { listingReadinessMode: "warn", merchantVerified: true, catalogCapReached: false, feeBpsByCategory: new Map([["cat-leaf", 1000]]), evidence: [] }
  const item = (id: string, over: Partial<StoredReadinessRow>, demand = { paidOrders30d: 0, resellersListing: 0 }, extra: Partial<CatalogReadinessProduct> = {}): CatalogReadinessProduct => ({
    productId: id,
    productName: id,
    row: row(over),
    active: true,
    holds: [],
    ageDays: 40,
    healthCodes: new Set(),
    ...demand,
    ...extra,
  })

  it("toFix: one fix per product, blockers before priorities, demand first; « prêt » never listed", () => {
    const c = buildCatalogReadiness(
      [
        item("ready", {}),
        item("noPhotoLive", { images: [] }, { paidOrders30d: 5, resellersListing: 2 }),
        item("noCommission", { commissionRate: 0 }, { paidOrders30d: 1, resellersListing: 1 }),
        item("draftNoPrice", { isDraft: true, basePriceCents: 0 }),
      ],
      ctx,
    )
    // Health report's scale: severity base × observed demand — 1000×5, 100×18, 1000×1.
    expect(c.toFix.map((p) => p.productId)).toEqual(["noCommission", "noPhotoLive", "draftNoPrice"])
    expect(c.byStage.live).toEqual({ bloquant: 1, a_corriger: 1, pret: 1 })
    expect(c.toFix.every((p) => p.nextFix && p.nextFix.level !== "recommande")).toBe(true)
  })

  it("readyNotSelling: buyable, technically ready, a weak commercial dimension — never a blocked product", () => {
    const c = buildCatalogReadiness(
      [
        item("lowNet", { basePriceCents: 500, commissionRate: 5 }, { paidOrders30d: 0, resellersListing: 1 }),
        item("soldOut", { stock: 0, basePriceCents: 500, commissionRate: 5 }),
        item("fine", {}, { paidOrders30d: 3, resellersListing: 2 }),
      ],
      ctx,
    )
    expect(c.readyNotSelling.map((p) => p.productId)).toEqual(["lowNet"])
    expect(c.toFix.map((p) => p.productId)).toContain("soldOut")
  })

  it("next best action: the readiness next fix replaces the health's sheet actions on that product; never for an Affisell hold", () => {
    const now = new Date("2026-11-23T12:00:00Z")
    const health = buildHealthReport(
      [
        {
          id: "p1", name: "Lampe", isDraft: false, active: true, listingKind: "PHYSICAL", basePriceCents: 3990, stock: 25, hasVariants: false, variantRowStocks: null,
          commissionExplicit: true, imageCount: 0, descriptionLength: 300, categoryId: null, hasGtin: true, deliveryMin: 2, deliveryMax: 4, safetyBlocking: [], holds: [],
          paidOrders30d: 4, resellersListing: 2, createdAt: new Date("2026-09-01T00:00:00Z"),
        },
      ],
      { now, readinessMode: "warn" },
    )
    const readiness = [
      summarizeProductReadiness(item("p1", { images: [], categoryId: null }, { paidOrders30d: 4, resellersListing: 2 }), ctx),
      summarizeProductReadiness(item("held", {}, { paidOrders30d: 9, resellersListing: 4 }, { holds: ["product_recalled"] }), ctx),
    ]
    const actions = supplierNextActions(health, 3, [], [], readiness)
    const p1 = actions.filter((a) => a.productId === "p1")
    expect(p1.map((a) => a.kind)).toEqual(["prepare_listing"])
    expect(p1[0].readiness).toMatchObject({ level: "prioritaire", basis: "publication_rule_live", live: true })
    expect(actions.some((a) => a.productId === "held")).toBe(false)
  })

  it("a priority on a live product without demand is not pushed as an action", () => {
    const now = new Date("2026-11-23T12:00:00Z")
    const empty = buildHealthReport([], { now, readinessMode: "warn" })
    const r = [summarizeProductReadiness(item("quiet", { images: [] }), ctx)]
    expect(supplierNextActions(empty, 3, [], [], r)).toEqual([])
  })
})

describe("texts", () => {
  it("new codes, live wording and the catalogue block exist in 8 locales; association never presented as a cause", () => {
    for (const loc of ["fr", "en", "de", "es", "it", "nl", "pl", "zh"]) {
      const m = JSON.parse(readFileSync(join(process.cwd(), `messages/${loc}.json`), "utf8"))
      const r = m.supplier.readiness
      for (const code of ["stock_unconfirmed", "held_by_affisell", "hold_unverifiable"]) for (const k of ["title", "why", "fix"]) expect(typeof r.finding[code][k], `${loc} ${code}.${k}`).toBe("string")
      for (const code of ["name_missing", "price_missing", "commission_not_explicit", "photo_missing", "category_missing", "warehouse_missing", "delivery_countries_missing", "safety_incomplete", "stock_missing", "stock_unconfirmed"]) {
        expect(typeof r.finding[code].whyLive, `${loc} ${code}.whyLive`).toBe("string")
      }
      const c = m.catalogHealth.readiness
      for (const k of ["title", "subtitle", "countsLive", "countsDraft", "toFixTitle", "nothingToFix", "readyNotSellingTitle", "readyNotSellingIntro", "openSheet", "moreInSheet", "method"]) expect(typeof c[k], `${loc} ${k}`).toBe("string")
      for (const d of ["disponibilite", "rentabilite_revendeur", "offre", "demande", "performance"]) expect(typeof c.weak[d], `${loc} weak.${d}`).toBe("string")
      expect(typeof m.nextActions.kind.prepare_listing).toBe("string")
      expect(typeof m.nextActions.cta.prepare_listing).toBe("string")
    }
    const fr = JSON.parse(readFileSync(join(process.cwd(), "messages/fr.json"), "utf8")).catalogHealth.readiness
    expect(fr.weak.offre).toMatch(/pas une garantie/)
    expect(fr.method).toMatch(/Rien n'est publié, retiré ni modifié/)
  })
})

import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  gtin14,
  matchSafetyGateAlerts,
  normalizeBrand,
  normalizeModel,
  parseWeeklyReport,
  parseWeeklyReportList,
  safetyGateReportUrl,
  safetyGateSignals,
  type CatalogIdentity,
} from "@/lib/strategic-intelligence/external/safety-gate"
import { listIntelligenceSources } from "@/lib/strategic-intelligence/sources"

/** Three alerts copied from the real Report-2026-45 (structure untouched) + one synthetic "unknown brand" alert. */
const report = readFileSync(join(__dirname, "fixtures/safety-gate-report-sample.xml"), "utf8")
const alerts = parseWeeklyReport(report)
const observedAt = "2026-11-17T08:00:00.000Z"
const reports = [{ reference: "Report-2026-45", publishedOn: "2026-11-13", id: "10000331" }]
const product = (p: Partial<CatalogIdentity> & { productId: string }): CatalogIdentity => ({ name: p.productId, gtin: null, brand: null, mpn: null, ...p })

describe("EU Safety Gate — parsing the official XML", () => {
  it("reads the list of weekly reports (newest first) and rebuilds each report URL from its numeric id", () => {
    const list = parseWeeklyReportList(
      `<Safety-Gate><weeklyReport><reference>Report-2026-44</reference><publicationDate>06/11/2026</publicationDate><URL>https://ec.europa.eu/safety-gate-alerts/api/download/weeklyReport/detail/xml/10000330?language=en&amp;search=WEB_REPORT%7C:%7C10000330,</URL></weeklyReport>` +
        `<weeklyReport><reference>Report-2026-45</reference><publicationDate>13/11/2026</publicationDate><URL>https://ec.europa.eu/safety-gate-alerts/api/download/weeklyReport/detail/xml/10000331?language=en&amp;search=x</URL></weeklyReport>` +
        `<weeklyReport><reference>bad</reference><publicationDate>13/11/2026</publicationDate><URL>https://evil.example/x</URL></weeklyReport></Safety-Gate>`
    )
    expect(list).toEqual([
      { reference: "Report-2026-45", publishedOn: "2026-11-13", id: "10000331" },
      { reference: "Report-2026-44", publishedOn: "2026-11-06", id: "10000330" },
    ])
    expect(safetyGateReportUrl("10000331")).toBe(
      "https://ec.europa.eu/safety-gate-alerts/api/download/weeklyReport/detail/xml/10000331?language=en&search=WEB_REPORT%7C:%7C10000331,"
    )
    expect(() => safetyGateReportUrl("../x")).toThrow()
  })

  it("reads each alert; keeps only VALID barcodes; refuses a non-official alert URL", () => {
    expect(alerts).toHaveLength(4)
    expect(alerts[0]).toMatchObject({
      caseNumber: "SR/03208/26",
      publishedOn: "2026-11-10",
      product: "Children's jacket",
      brands: ["Jojo Maman Bébé"],
      models: ["C52-683-145-000161"],
      gtins: ["05054298241091"],
      level: "Serious risk",
      countryOfOrigin: "People's Republic of China",
    })
    expect(alerts[1]!.models).toEqual(["10.2.17.25.271", "2175334.5906.ONE SIZE"])
    expect(alerts[2]!.brands).toEqual(["FB Sister", "New Yorker"])
    expect(alerts[2]!.gtins).toEqual([]) // "4026889346704027": 16 digits, not a GTIN
    expect(alerts[3]!.url).toBeNull()
    expect(alerts[3]!.gtins).toEqual([])
  })

  it("normalises identifiers conservatively", () => {
    expect(gtin14("5054298241091")).toBe("05054298241091")
    expect(gtin14("5054298241092")).toBeNull() // wrong check digit
    expect(normalizeBrand("Jojo Maman Bébé®")).toBe("jojo maman bebe")
    expect(normalizeBrand("Unknown")).toBe("")
    expect(normalizeBrand("N/A")).toBe("")
    expect(normalizeBrand("Other(next.lu)")).toBe("")
    expect(normalizeModel("C52-683-145-000161")).toBe("C52683145000161")
    expect(normalizeModel("ABC")).toBe("") // too short
    expect(normalizeModel("JACKET")).toBe("") // no digit: a word, not a model
  })
})

describe("EU Safety Gate — catalogue matching (no false 'your product is dangerous')", () => {
  it("exact GTIN = certain match, critical for a serious risk", () => {
    const matches = matchSafetyGateAlerts(alerts, [product({ productId: "p1", gtin: "5054298241091" })])
    expect(matches).toEqual([expect.objectContaining({ productId: "p1", kind: "exact_gtin", matchedOn: "5054298241091" })])
    const [s] = safetyGateSignals({ reports, alerts, matches, coverage: { activeProducts: 1, withValidGtin: 1, withBrandAndModel: 0 } }, { observedAt })
    expect(s).toMatchObject({ id: "risk:safety-gate:SR/03208/26:p1", priority: "critical", kind: "fact", confidence: "high" })
    expect(s!.recommendedAction).toMatch(/Rien n'a été modifié automatiquement/)
  })

  it("brand + model = probable match, labelled a hypothesis to verify", () => {
    const matches = matchSafetyGateAlerts(alerts, [product({ productId: "p2", brand: "S.Oliver", mpn: "10 2 17 25 271" })])
    expect(matches).toEqual([expect.objectContaining({ productId: "p2", kind: "brand_model" })])
    const [s] = safetyGateSignals({ reports, alerts, matches, coverage: { activeProducts: 1, withValidGtin: 0, withBrandAndModel: 1 } }, { observedAt })
    expect(s).toMatchObject({ priority: "important", kind: "hypothesis", confidence: "medium" })
  })

  it("never matches on a name, a generic brand, a short model, an invalid barcode or a brand alone", () => {
    const catalog = [
      product({ productId: "name-only", name: "Children's jacket Baby Jacket Flower" }),
      product({ productId: "unknown-brand", brand: "Unknown", mpn: "1234" }),
      product({ productId: "brand-only", brand: "s.Oliver" }),
      product({ productId: "model-only", mpn: "C52-683-145-000161" }),
      product({ productId: "bad-barcode", gtin: "4026889346704027" }),
      product({ productId: "other-brand-same-model", brand: "Zara", mpn: "02.02.152.1268" }),
    ]
    expect(matchSafetyGateAlerts(alerts, catalog)).toEqual([])
  })

  it("one product matched by GTIN and brand+model is reported once", () => {
    const matches = matchSafetyGateAlerts(alerts, [product({ productId: "p3", gtin: "4099979071513", brand: "s.Oliver", mpn: "10.2.17.25.271" })])
    expect(matches).toHaveLength(1)
    expect(matches[0]!.kind).toBe("exact_gtin")
  })

  it("says how much of the catalogue the check can see", () => {
    const out = safetyGateSignals(
      { reports, alerts, matches: [], coverage: { activeProducts: 200, withValidGtin: 30, withBrandAndModel: 12 } },
      { observedAt }
    )
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ priority: "study", kind: "fact" })
    expect(out[0]!.title).toMatch(/15 % des produits actifs/)
    expect(safetyGateSignals({ reports, alerts, matches: [], coverage: { activeProducts: 10, withValidGtin: 9, withBrandAndModel: 0 } }, { observedAt })).toEqual([])
  })

  it("the source is 'connected' only when this run read it", () => {
    expect(listIntelligenceSources({}).find((s) => s.id === "eu.safety_gate")!.status).toBe("not_connected")
    expect(listIntelligenceSources({}, new Set(["eu.safety_gate"])).find((s) => s.id === "eu.safety_gate")!.status).toBe("connected")
  })
})

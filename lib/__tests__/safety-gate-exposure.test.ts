import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { parseWeeklyReport, type SafetyGateAlert } from "@/lib/strategic-intelligence/external/safety-gate"
import {
  aggregateAlertsByCategory,
  categoryExposureSignals,
  ROOT_LABELS,
  SAFETY_GATE_CATEGORY_ROOTS,
} from "@/lib/strategic-intelligence/external/safety-gate-exposure"

const real = parseWeeklyReport(readFileSync(join(__dirname, "fixtures/safety-gate-report-sample.xml"), "utf8"))
const alert = (over: Partial<SafetyGateAlert>): SafetyGateAlert => ({ ...real[0]!, ...over })
const ctx = { observedAt: "2026-11-17T09:00:00.000Z", window: null }

describe("Safety Gate × catalogue × sales, by category", () => {
  it("maps only to real Google-taxonomy roots", () => {
    const roots = new Set(readFileSync("prisma/taxonomy-en.txt", "utf8").split("\n").filter((l) => /^\d+ - [^>]+$/.test(l)).map((l) => Number(l.split(" - ")[0])))
    for (const ids of Object.values(SAFETY_GATE_CATEGORY_ROOTS)) for (const id of ids) {
      expect(roots.has(id), String(id)).toBe(true)
      expect(ROOT_LABELS[id]).toBeTruthy()
    }
  })

  it("aggregates alerts per category: serious share, top risks, origin; unknown categories stay unmapped", () => {
    const stats = aggregateAlertsByCategory([
      ...real,
      alert({ category: "Pyrotechnic articles", riskTypes: "Burns" }),
    ])
    const clothing = stats.find((s) => s.category === "clothing, textiles and fashion items")!
    expect(clothing).toMatchObject({ alerts: 3, serious: 3, roots: [166], chinaShareBps: 10_000 })
    expect(clothing.topRisks[0]).toEqual(["Chemical", 3])
    expect(stats.find((s) => s.category === "pyrotechnic articles")!.roots).toBeNull()
  })

  it("important only with enough serious alerts, real sales AND products we can not check by barcode", () => {
    const stats = aggregateAlertsByCategory(Array.from({ length: 6 }, (_, i) => alert({ caseNumber: `X${i}`, category: "Toys" })))
    const exposed = categoryExposureSignals(
      { stats, exposure: new Map([[1239, { activeProducts: 40, withValidGtin: 4, units30: 25 }]]), reportsLabel: "R", weeks: 8 },
      ctx
    )
    expect(exposed).toHaveLength(1)
    expect(exposed[0]).toMatchObject({ priority: "important", kind: "estimate", id: "risk:safety-gate-category:toys:2026-W47" })
    expect(exposed[0]!.evidence.find((e) => e.label.startsWith("Produits contrôlables"))!.value).toBe("4 (10 %)")
    const covered = categoryExposureSignals(
      { stats, exposure: new Map([[1239, { activeProducts: 40, withValidGtin: 36, units30: 25 }]]), reportsLabel: "R", weeks: 8 },
      ctx
    )
    expect(covered[0]!.priority).toBe("study")
    // Nothing sold or listed there: no signal at all.
    expect(categoryExposureSignals({ stats, exposure: new Map(), reportsLabel: "R", weeks: 8 }, ctx)).toEqual([])
  })
})

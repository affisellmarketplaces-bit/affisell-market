import { describe, expect, it } from "vitest"

import { fxMoves, fxSignals, parseEcbHistXml } from "@/lib/strategic-intelligence/external/ecb-fx"
import { listIntelligenceSources } from "@/lib/strategic-intelligence/sources"

/** Same shape as the ECB file (gesmes envelope, one Cube per day, one Cube per currency). */
function ecbXml(days: Array<[string, number, number]>): string {
  const cubes = days
    .map(([date, usd, cny]) => `<Cube time="${date}">\n<Cube currency="USD" rate="${usd}"/>\n<Cube currency="JPY" rate="170.1"/>\n<Cube currency="CNY" rate="${cny}"/>\n</Cube>`)
    .join("\n")
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">\n<gesmes:subject>Reference rates</gesmes:subject>\n<Cube>\n${cubes}\n</Cube>\n</gesmes:Envelope>`
}

describe("ECB reference rates — parser", () => {
  it("reads every day and currency, newest first, and ignores malformed rows", () => {
    const xml = ecbXml([
      ["2026-10-01", 1.17, 8.3],
      ["2026-11-16", 1.12, 8.0],
    ]).replace('<Cube currency="JPY" rate="170.1"/>', '<Cube currency="JPY" rate="abc"/>')
    const days = parseEcbHistXml(xml)
    expect(days.map((d) => d.date)).toEqual(["2026-11-16", "2026-10-01"])
    expect(days[0]!.rates).toMatchObject({ USD: 1.12, CNY: 8.0 })
    expect(parseEcbHistXml("<html>maintenance</html>")).toEqual([])
  })
})

describe("ECB reference rates — detection", () => {
  const days = parseEcbHistXml(
    ecbXml([
      ["2026-11-16", 1.12, 8.25],
      ["2026-10-20", 1.16, 8.3],
      ["2026-10-16", 1.17, 8.31],
      ["2026-10-01", 1.18, 8.4],
    ])
  )

  it("compares with the last rate published 30+ days before the latest", () => {
    const [usd, cny] = fxMoves(days)
    expect(usd).toMatchObject({ currency: "USD", baseDate: "2026-10-16", base: 1.17, latest: 1.12 })
    expect(usd!.euroChangeBps).toBe(Math.round(((1.12 - 1.17) / 1.17) * 10_000)) // −4.3 %
    expect(cny!.euroChangeBps).toBe(Math.round(((8.25 - 8.31) / 8.31) * 10_000)) // −0.7 %
  })

  it("a ≥ 3 % fall of the euro is an important supplier-cost signal when AliExpress costs are exposed; small moves stay silent", () => {
    const out = fxSignals(fxMoves(days), { observedAt: "2026-11-17T08:00:00.000Z", exposure: { activeAeLinks: 42, autoBuyLinks: 7 } })
    expect(out).toHaveLength(1) // CNY −0.7 % is below the threshold
    expect(out[0]).toMatchObject({ id: "supplier:fx:USD:weaker:2026-11-16", priority: "important", kind: "fact", confidence: "high" })
    expect(out[0]!.source).toMatchObject({ id: "ecb.eurofxref" })
    expect(out[0]!.title).toMatch(/hausse d'environ \+4,5 %/) // 1.17 / 1.12 − 1
    expect(out[0]!.evidence.find((e) => e.label.startsWith("Liens"))!.value).toBe("42")
  })

  it("stale data keeps the signal but says so", () => {
    const out = fxSignals(fxMoves(days), { observedAt: "2026-11-25T08:00:00.000Z", exposure: { activeAeLinks: 1, autoBuyLinks: 0 } })
    expect(out[0]).toMatchObject({ confidence: "low" })
    expect(out[0]!.confidenceReason).toMatch(/périmée/)
  })

  it("not enough history = no comparison, no signal", () => {
    expect(fxMoves(parseEcbHistXml(ecbXml([["2026-11-16", 1.12, 8.25]])))).toEqual([])
  })

  it("the source is 'connected' only when this run read it", () => {
    expect(listIntelligenceSources({}).find((s) => s.id === "ecb.eurofxref")!.status).toBe("not_connected")
    expect(listIntelligenceSources({}, new Set(["ecb.eurofxref"])).find((s) => s.id === "ecb.eurofxref")!.status).toBe("connected")
  })
})

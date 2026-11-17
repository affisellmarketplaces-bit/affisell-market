import { describe, expect, it } from "vitest"

import {
  buildOsvBatches,
  compareVersions,
  dependencySignals,
  nextFixedVersion,
  osvVulnUrl,
  parseOsvBatch,
  parseOsvVuln,
  type OsvVuln,
} from "@/lib/strategic-intelligence/external/osv"
import { listIntelligenceSources } from "@/lib/strategic-intelligence/sources"

/** Shapes from the OSV API reference (https://google.github.io/osv.dev/api/): querybatch results and a GHSA record. */
const ghsa = {
  id: "GHSA-xxxx-yyyy-zzzz",
  summary: "Authorization bypass in middleware",
  aliases: ["CVE-2026-12345"],
  database_specific: { severity: "CRITICAL" },
  affected: [
    { package: { ecosystem: "npm", name: "next" }, ranges: [{ type: "SEMVER", events: [{ introduced: "16.0.0" }, { fixed: "16.4.5" }] }] },
    { package: { ecosystem: "npm", name: "next" }, ranges: [{ type: "SEMVER", events: [{ introduced: "15.0.0" }, { fixed: "15.5.9" }] }] },
  ],
}

describe("OSV.dev watch", () => {
  it("batches ≤ 1000 queries and pairs each answer with its query", () => {
    const pkgs = Array.from({ length: 1352 }, (_, i) => [`p${i}`, "1.0.0"] as [string, string])
    const batches = buildOsvBatches(pkgs)
    expect(batches.map((b) => b.queries.length)).toEqual([1000, 352])
    expect(batches[0]!.queries[0]).toEqual({ package: { name: "p0", ecosystem: "npm" }, version: "1.0.0" })
    const hits = parseOsvBatch({ results: [{}, { vulns: [{ id: "GHSA-1" }, { id: "GHSA-2" }] }] }, [["a", "1.0.0"], ["b", "2.0.0"]])
    expect(hits).toEqual([
      { name: "b", version: "2.0.0", vulnId: "GHSA-1" },
      { name: "b", version: "2.0.0", vulnId: "GHSA-2" },
    ])
    expect(() => parseOsvBatch({ results: [{}] }, [["a", "1"], ["b", "2"]])).toThrow("osv_batch_unparseable")
    expect(() => osvVulnUrl("../../x")).toThrow()
  })

  it("reads severity and picks the cheapest fixed version above the installed one", () => {
    const v = parseOsvVuln(ghsa)!
    expect(v).toMatchObject({ id: "GHSA-xxxx-yyyy-zzzz", severity: "critical", withdrawn: false })
    expect(nextFixedVersion("16.4.3", v.fixedByPackage.next!)).toBe("16.4.5")
    expect(nextFixedVersion("16.4.5", v.fixedByPackage.next!)).toBeNull()
    expect(compareVersions("16.10.0", "16.9.9")).toBeGreaterThan(0)
    expect(compareVersions("5.0.0-beta.32", "5.0.0")).toBeLessThan(0)
    expect(parseOsvVuln({ ...ghsa, database_specific: {} })!.severity).toBe("unknown")
  })

  it("ONE signal per installed version (worst severity, version that closes all); moderate / low / withdrawn folded or ignored", () => {
    const crit = parseOsvVuln(ghsa)!
    const high: OsvVuln = { ...crit, id: "GHSA-high", severity: "high", aliases: [], fixedByPackage: { next: ["16.4.7"] } }
    const mod: OsvVuln = { ...crit, id: "GHSA-mod", severity: "moderate", aliases: [] }
    const gone: OsvVuln = { ...crit, id: "GHSA-gone", withdrawn: true }
    const out = dependencySignals(
      {
        hits: [
          { name: "next", version: "16.4.3", vulnId: crit.id },
          { name: "next", version: "16.4.3", vulnId: "GHSA-high" },
          { name: "postcss", version: "8.5.1", vulnId: "GHSA-mod" },
          { name: "next", version: "16.4.3", vulnId: "GHSA-gone" },
        ],
        vulns: new Map([[crit.id, crit], ["GHSA-high", high], ["GHSA-mod", mod], ["GHSA-gone", gone]]),
        detailsMissing: 0,
        packagesChecked: 1352,
      },
      { observedAt: "2026-11-17T09:00:00.000Z" }
    )
    expect(out.map((s) => [s.id, s.priority])).toEqual([
      ["risk:dependency:next@16.4.3", "critical"],
      ["risk:dependency:minor:2026-11-17", "study"],
    ])
    expect(out[0]!.title).toBe("2 faille(s) dont une critique sur next 16.4.3")
    expect(out[0]!.evidence.find((e) => e.label === "Version qui corrige tout")!.value).toBe("16.4.7")
    expect(out[0]!.evidence.some((e) => e.label.includes("CVE-2026-12345"))).toBe(true)
    expect(out[0]!.confidenceReason).toMatch(/n'est pas évalué/)
  })

  it("the source is 'connected' only when this run read it", () => {
    expect(listIntelligenceSources({}).find((s) => s.id === "osv.dev")!.status).toBe("not_connected")
    expect(listIntelligenceSources({}, new Set(["osv.dev"])).find((s) => s.id === "osv.dev")!.status).toBe("connected")
  })
})

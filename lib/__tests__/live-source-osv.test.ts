import { describe, expect, it } from "vitest"

import { nextFixedVersion } from "@/lib/strategic-intelligence/external/osv"
import { scanDependenciesWithOsv } from "@/lib/strategic-intelligence/external/osv.server"

/** LIVE check of OSV.dev against the real production inventory (opt-in, see live-source-ecb.test.ts). */
describe.skipIf(process.env.AFFISELL_LIVE_SOURCES !== "1")("OSV.dev — live read", () => {
  it("checks every production package with the production code path", async () => {
    const scan = await scanDependenciesWithOsv()
    expect(scan.packagesChecked).toBeGreaterThan(1000)
    const bySeverity: Record<string, number> = {}
    for (const v of scan.vulns.values()) bySeverity[v.severity] = (bySeverity[v.severity] ?? 0) + 1
    const pkgs = new Set(scan.hits.map((h) => h.name))
    console.log(
      `[live-source-osv] ${scan.packagesChecked} packages, ${scan.hits.length} hits on ${pkgs.size} packages, ` +
        `${scan.vulns.size} advisories read (${JSON.stringify(bySeverity)}), ${scan.detailsMissing} not detailed`
    )
    for (const h of scan.hits) {
      const v = scan.vulns.get(h.vulnId)
      if (!v || v.withdrawn || (v.severity !== "critical" && v.severity !== "high")) continue
      console.log(`[live-source-osv] ${v.severity} ${h.name}@${h.version} ${v.id} fixed=${nextFixedVersion(h.version, v.fixedByPackage[h.name] ?? []) ?? "none"} — ${v.summary.slice(0, 90)}`)
    }
  }, 120_000)
})

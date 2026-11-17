import "server-only"

import pkg from "@/package.json"
import inventory from "@/lib/strategic-intelligence/external/dependency-inventory.json"
import {
  buildOsvBatches,
  OSV_BATCH_SIZE,
  OSV_QUERYBATCH_URL,
  osvVulnUrl,
  parseOsvBatch,
  parseOsvVuln,
  type DependencyHit,
  type InstalledPackage,
  type OsvVuln,
} from "@/lib/strategic-intelligence/external/osv"

/** At most this many advisories are read in detail per refresh (GET /v1/vulns/{id}). */
export const OSV_MAX_DETAILS = 120
const CACHE_MS = 6 * 3_600_000
let cache: { at: number; value: OsvScan } | null = null

export type OsvScan = { hits: DependencyHit[]; vulns: Map<string, OsvVuln>; detailsMissing: number; packagesChecked: number }

async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000), cache: "no-store" })
  if (!res.ok) throw new Error(`osv_http_${res.status}`)
  const text = await res.text()
  if (text.length > 5_000_000) throw new Error("osv_too_large")
  return JSON.parse(text) as unknown
}

/**
 * Checks the production inventory against OSV.dev (≤ 2 batch calls + ≤ OSV_MAX_DETAILS detail calls, advisories on
 * DIRECT dependencies read first), cached 6 h per instance.
 */
export async function scanDependenciesWithOsv(now = Date.now()): Promise<OsvScan> {
  if (cache && now - cache.at < CACHE_MS) return cache.value
  const packages = (inventory as unknown as { packages: InstalledPackage[] }).packages
  const hits: DependencyHit[] = []
  const batches = buildOsvBatches(packages)
  for (let i = 0; i < batches.length; i++) {
    const json = await getJson(OSV_QUERYBATCH_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(batches[i]),
    })
    hits.push(...parseOsvBatch(json, packages.slice(i * OSV_BATCH_SIZE, (i + 1) * OSV_BATCH_SIZE)))
  }
  const direct = new Set(Object.keys((pkg as { dependencies?: Record<string, string> }).dependencies ?? {}))
  const ordered = [...hits].sort((a, b) => Number(direct.has(b.name)) - Number(direct.has(a.name)))
  const ids = [...new Set(ordered.map((h) => h.vulnId))]
  const vulns = new Map<string, OsvVuln>()
  for (const id of ids.slice(0, OSV_MAX_DETAILS)) {
    const v = parseOsvVuln(await getJson(osvVulnUrl(id)))
    if (v) vulns.set(id, v)
  }
  const value = { hits, vulns, detailsMissing: Math.max(0, ids.length - OSV_MAX_DETAILS), packagesChecked: packages.length }
  cache = { at: now, value }
  return value
}

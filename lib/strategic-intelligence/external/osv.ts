import type { StrategicSignal } from "@/lib/strategic-intelligence/types"

/**
 * OSV.dev — the open vulnerability database (OpenSSF; aggregates the GitHub Security Advisories, npm, …): public, free,
 * no key. Checked against the EXACT production versions Affisell installs (dependency-inventory.json, generated from
 * package-lock.json), so a match means "the installed version is listed as affected" — not that Affisell's code path
 * is exploitable, which the signal says.
 *
 * API (https://google.github.io/osv.dev/api/): POST /v1/querybatch with ≤ 1000 {package:{name,ecosystem},version}
 * queries → ids per query; GET /v1/vulns/{id} → summary, aliases, affected ranges (the "fixed" version), and for GitHub
 * advisories `database_specific.severity` (LOW / MODERATE / HIGH / CRITICAL).
 */
export const OSV_QUERYBATCH_URL = "https://api.osv.dev/v1/querybatch"
export const osvVulnUrl = (id: string) => {
  if (!/^[A-Za-z0-9._:-]{3,80}$/.test(id)) throw new Error("osv_bad_id")
  return `https://api.osv.dev/v1/vulns/${encodeURIComponent(id)}`
}
export const OSV_BATCH_SIZE = 1000

export type InstalledPackage = [name: string, version: string]
export type OsvSeverity = "critical" | "high" | "moderate" | "low" | "unknown"
export type OsvVuln = { id: string; summary: string; aliases: string[]; severity: OsvSeverity; fixedByPackage: Record<string, string[]>; withdrawn: boolean }
export type DependencyHit = { name: string; version: string; vulnId: string }

export function buildOsvBatches(packages: InstalledPackage[]): Array<{ queries: Array<{ package: { name: string; ecosystem: "npm" }; version: string }> }> {
  const out = []
  for (let i = 0; i < packages.length; i += OSV_BATCH_SIZE) {
    out.push({ queries: packages.slice(i, i + OSV_BATCH_SIZE).map(([name, version]) => ({ package: { name, ecosystem: "npm" as const }, version })) })
  }
  return out
}

/** Pairs each answer with the query it answers (OSV keeps the order). */
export function parseOsvBatch(json: unknown, batch: InstalledPackage[]): DependencyHit[] {
  const results = (json as { results?: unknown } | null)?.results
  if (!Array.isArray(results) || results.length !== batch.length) throw new Error("osv_batch_unparseable")
  const out: DependencyHit[] = []
  results.forEach((r, i) => {
    const vulns = (r as { vulns?: Array<{ id?: unknown }> } | null)?.vulns
    if (!Array.isArray(vulns)) return
    for (const v of vulns) if (typeof v?.id === "string") out.push({ name: batch[i]![0], version: batch[i]![1], vulnId: v.id })
  })
  return out
}

const SEVERITIES: Record<string, OsvSeverity> = { CRITICAL: "critical", HIGH: "high", MODERATE: "moderate", MEDIUM: "moderate", LOW: "low" }

export function parseOsvVuln(json: unknown): OsvVuln | null {
  const v = json as Record<string, unknown> | null
  if (!v || typeof v.id !== "string") return null
  const ds = (v.database_specific ?? {}) as Record<string, unknown>
  const sev = typeof ds.severity === "string" ? SEVERITIES[ds.severity.toUpperCase()] ?? "unknown" : "unknown"
  const fixedByPackage: Record<string, string[]> = {}
  for (const a of Array.isArray(v.affected) ? v.affected : []) {
    const pkg = (a as { package?: { name?: unknown; ecosystem?: unknown } }).package
    if (!pkg || pkg.ecosystem !== "npm" || typeof pkg.name !== "string") continue
    for (const range of Array.isArray((a as { ranges?: unknown }).ranges) ? ((a as { ranges: unknown[] }).ranges) : []) {
      for (const e of Array.isArray((range as { events?: unknown }).events) ? ((range as { events: unknown[] }).events) : []) {
        const fixed = (e as { fixed?: unknown }).fixed
        if (typeof fixed === "string") (fixedByPackage[pkg.name] ??= []).push(fixed)
      }
    }
  }
  return {
    id: v.id,
    summary: typeof v.summary === "string" ? v.summary.slice(0, 300) : "",
    aliases: Array.isArray(v.aliases) ? v.aliases.filter((x): x is string => typeof x === "string").slice(0, 5) : [],
    severity: sev,
    fixedByPackage,
    withdrawn: typeof v.withdrawn === "string" && v.withdrawn.length > 0,
  }
}

/** Numeric semver compare on major.minor.patch (pre-release tags compare as lower) — enough to pick "the next fix". */
export function compareVersions(a: string, b: string): number {
  const p = (s: string) => {
    const [core, pre] = s.split("-", 2)
    return { n: (core ?? "").split(".").map((x) => Number.parseInt(x, 10) || 0), pre: pre ?? null }
  }
  const x = p(a)
  const y = p(b)
  for (let i = 0; i < 3; i++) if ((x.n[i] ?? 0) !== (y.n[i] ?? 0)) return (x.n[i] ?? 0) - (y.n[i] ?? 0)
  if (x.pre === y.pre) return 0
  if (x.pre === null) return 1
  if (y.pre === null) return -1
  return x.pre.localeCompare(y.pre)
}

/** The smallest fixed version above the installed one (the cheapest upgrade that closes the advisory). */
export function nextFixedVersion(installed: string, fixed: string[]): string | null {
  const candidates = fixed.filter((f) => compareVersions(f, installed) > 0).sort(compareVersions)
  return candidates[0] ?? null
}

/**
 * One signal per installed package VERSION (not per advisory: a package can carry five advisories, all closed by one
 * upgrade). Priority = the worst critical / high advisory; "fix" = the smallest version that closes ALL of them.
 * Moderate / low advisories are folded into one `study` signal; withdrawn ones are ignored.
 */
export function dependencySignals(
  input: { hits: DependencyHit[]; vulns: Map<string, OsvVuln>; detailsMissing: number; packagesChecked: number },
  ctx: { observedAt: string }
): StrategicSignal[] {
  const out: StrategicSignal[] = []
  let minor = 0
  const minorPkgs = new Set<string>()
  const serious = new Map<string, { name: string; version: string; vulns: OsvVuln[] }>()
  for (const h of input.hits) {
    const v = input.vulns.get(h.vulnId)
    if (!v || v.withdrawn) continue
    if (v.severity !== "critical" && v.severity !== "high") {
      minor++
      minorPkgs.add(h.name)
      continue
    }
    const key = `${h.name}@${h.version}`
    const g = serious.get(key) ?? { name: h.name, version: h.version, vulns: [] }
    if (!g.vulns.some((x) => x.id === v.id)) g.vulns.push(v)
    serious.set(key, g)
  }
  const groups = [...serious.values()].sort(
    (a, b) => Number(b.vulns.some((v) => v.severity === "critical")) - Number(a.vulns.some((v) => v.severity === "critical")) || b.vulns.length - a.vulns.length
  )
  for (const g of groups) {
    const critical = g.vulns.some((v) => v.severity === "critical")
    const fixes = g.vulns.map((v) => nextFixedVersion(g.version, v.fixedByPackage[g.name] ?? []))
    const allFixable = fixes.every((f): f is string => Boolean(f))
    const fixAll = allFixable ? [...fixes].sort(compareVersions).at(-1)! : null
    const refs = g.vulns.map((v) => v.aliases.find((a) => a.startsWith("CVE-")) ?? v.id)
    out.push({
      id: `risk:dependency:${g.name}@${g.version}`,
      domain: "regulatory_risk",
      priority: critical ? "critical" : "important",
      kind: "fact",
      title: `${g.vulns.length} faille(s) ${critical ? "dont une critique" : "élevée(s)"} sur ${g.name} ${g.version}`,
      evidence: [
        { label: "Version installée en production", value: `${g.name}@${g.version}` },
        { label: "Version qui corrige tout", value: fixAll ?? "au moins un avis sans version corrective" },
        ...g.vulns.slice(0, 5).map((v, i) => ({ label: `${v.severity === "critical" ? "Critique" : "Élevée"} — ${refs[i]}`, value: v.summary || v.id })),
        ...(g.vulns.length > 5 ? [{ label: "Autres avis", value: String(g.vulns.length - 5) }] : []),
      ],
      source: { id: "osv.dev", query: `querybatch npm ${g.name}@${g.version} → ${g.vulns.map((v) => v.id).join(", ")}` },
      observedAt: ctx.observedAt,
      window: null,
      confidence: "high",
      confidenceReason:
        "La version exacte installée (package-lock.json) est listée comme affectée. Qu'Affisell utilise la partie vulnérable n'est pas évalué ici.",
      recommendedAction: fixAll
        ? `Passer ${g.name} en ${fixAll} (ou plus) — directement ou via la dépendance qui l'apporte / un « override » —, vérifier en isolation (procédure « Dependencies » d'AGENTS.md), puis régénérer l'inventaire.`
        : `Au moins un avis n'a pas de correctif publié : évaluer si Affisell utilise la fonction concernée et s'il existe un contournement.`,
      link: null,
    })
  }
  if (minor > 0 || input.detailsMissing > 0) {
    out.push({
      id: `risk:dependency:minor:${ctx.observedAt.slice(0, 10)}`,
      domain: "regulatory_risk",
      priority: "study",
      kind: "fact",
      title: `${minor} faille(s) modérée(s) ou faible(s) dans ${minorPkgs.size} paquet(s) installé(s)`,
      evidence: [
        { label: "Paquets de production vérifiés", value: String(input.packagesChecked) },
        { label: "Paquets concernés", value: [...minorPkgs].slice(0, 12).join(", ") + (minorPkgs.size > 12 ? "…" : "") || "—" },
        { label: "Avis non détaillés (plafond de lecture)", value: String(input.detailsMissing) },
      ],
      source: { id: "osv.dev", query: "querybatch npm (inventaire de production)" },
      observedAt: ctx.observedAt,
      window: null,
      confidence: "high",
      confidenceReason: "Versions exactes de package-lock.json ; gravité donnée par l'avis lui-même.",
      recommendedAction: "Regrouper ces mises à jour dans le prochain lot de dépendances (vérification en isolation).",
      link: null,
    })
  }
  return out
}

import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import {
  evaluateLeadingIndicator,
  isoWeekOf,
  pageviewsUrl,
  parsePageviews,
  spearman,
  weeksBetween,
  WIKIMEDIA_PROJECTS,
} from "@/lib/strategic-intelligence/external/wikipedia-demand"
import { listIntelligenceSources } from "@/lib/strategic-intelligence/sources"

const weeks = weeksBetween("2025-11-17", "2026-11-15") // 52 full ISO weeks

/** Deterministic noise. */
function noise(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

function series(values: number[]) {
  return new Map(weeks.map((w, i) => [w, values[i] ?? 0]))
}

describe("Wikimedia URL and parsing", () => {
  it("fixed host, whitelisted project, encoded title (a '/' becomes %2F)", () => {
    expect(pageviewsUrl("fr.wikipedia", "Friteuse sans huile", "2026-10-01", "2026-11-10")).toBe(
      "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/fr.wikipedia/all-access/user/Friteuse_sans_huile/daily/20261001/20261110"
    )
    expect(pageviewsUrl("en.wikipedia", "AC/DC", "2026-01-01", "2026-01-02")).toContain("/AC%2FDC/")
    expect(() => pageviewsUrl("evil.example", "X", "2026-01-01", "2026-01-02")).toThrow("wikipedia_bad_project")
    expect(() => pageviewsUrl("fr.wikipedia", "X", "2026/01/01", "2026-01-02")).toThrow("wikipedia_bad_date")
  })

  it("keeps well-formed rows only", () => {
    const rows = parsePageviews({ items: [{ timestamp: "2026100100", views: 120 }, { timestamp: "bad", views: 3 }, { timestamp: "2026100200", views: -1 }] })
    expect(rows).toEqual([{ date: "2026-10-01", views: 120 }])
    expect(() => parsePageviews({})).toThrow("wikipedia_unparseable")
  })

  it("ISO weeks: a Sunday belongs to the week of the Monday before it", () => {
    expect(isoWeekOf("2026-11-16")).toBe("2026-W47")
    expect(isoWeekOf("2026-11-22")).toBe("2026-W47")
    expect(isoWeekOf("2027-01-01")).toBe("2026-W53")
    expect(weeks).toHaveLength(52)
  })

  it("spearman: perfect, inverse, tied", () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1, 10)
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1, 10)
    expect(spearman([1, 1, 1, 1], [1, 2, 3, 4])).toBe(0)
  })
})

describe("evaluation — finds a lead only when there is one", () => {
  const r = noise(7)
  const views = weeks.map(() => 1000 + Math.round(r() * 2000))

  it("orders that follow the views two weeks later → predictive, lag 2", () => {
    const orders = weeks.map((_, i) => (i >= 2 ? Math.round(views[i - 2]! / 40) : 30))
    const ev = evaluateLeadingIndicator(series(views), series(orders), weeks)
    expect(ev.verdict).toBe("predictive")
    expect(ev.best?.lag).toBe(2)
  })

  it("orders that move WITH the views → concurrent_only (too late to act)", () => {
    const orders = views.map((v) => Math.round(v / 40))
    expect(evaluateLeadingIndicator(series(views), series(orders), weeks).verdict).toBe("concurrent_only")
  })

  it("unrelated orders → not_shown (never 'no link')", () => {
    const r2 = noise(99)
    const orders = weeks.map(() => 20 + Math.round(r2() * 40))
    const ev = evaluateLeadingIndicator(series(views), series(orders), weeks)
    expect(ev.verdict).toBe("not_shown")
    expect(ev.reason).toMatch(/Aucun lien démontré/)
  })

  it("short history or few orders → insufficient", () => {
    expect(evaluateLeadingIndicator(series(views), series(weeks.map(() => 0)), weeks).verdict).toBe("insufficient")
    expect(evaluateLeadingIndicator(series(views), series(weeks.map(() => 5)), weeks.slice(0, 20)).verdict).toBe("insufficient")
  })

  it("is deterministic (seeded permutations)", () => {
    const orders = weeks.map((_, i) => (i >= 1 ? Math.round(views[i - 1]! / 50) : 20))
    expect(evaluateLeadingIndicator(series(views), series(orders), weeks)).toEqual(evaluateLeadingIndicator(series(views), series(orders), weeks))
  })
})

describe("governance", () => {
  it("the source is listed as NOT connected — it is under evaluation, never read by the cockpit", () => {
    const s = listIntelligenceSources({}).find((x) => x.id === "wikimedia.pageviews")!
    expect(s.status).toBe("not_connected")
    expect(s.note).toMatch(/EN ÉVALUATION/)
    const collector = readFileSync("lib/strategic-intelligence/collect.server.ts", "utf8")
    expect(collector).not.toMatch(/wikipedia-demand|wikimedia/)
  })

  it("candidates: whitelisted projects and real Google-taxonomy root ids", () => {
    const { candidates } = JSON.parse(readFileSync("lib/strategic-intelligence/external/wikipedia-candidates.json", "utf8")) as {
      candidates: Array<{ root: number; articles: Array<{ project: string; title: string }> }>
    }
    const taxonomy = readFileSync("prisma/taxonomy-en.txt", "utf8")
    for (const c of candidates) {
      expect(taxonomy).toMatch(new RegExp(`^${c.root} - [^>]+$`, "m"))
      for (const a of c.articles) expect(WIKIMEDIA_PROJECTS as readonly string[]).toContain(a.project)
    }
  })
})

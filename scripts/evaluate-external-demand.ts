/**
 * READ-ONLY evaluation of EXTERNAL DEMAND INDICATORS against Affisell's REAL orders (AFFISELL INTELLIGENCE).
 *
 * For every candidate in lib/strategic-intelligence/external/wikipedia-candidates.json: weekly Wikipedia views of the
 * article (Wikimedia API, public, no key) vs weekly PAID orders of the products in that Google-taxonomy root category,
 * over the last 52 weeks, with the exact test of `evaluateLeadingIndicator` (week-over-week changes, Spearman, permutation
 * p-value, Bonferroni over lags). It prints a verdict per article: predictive / concurrent_only / not_shown / insufficient.
 * NOTHING is written anywhere and nothing is connected: a source is wired into the cockpit only after a `predictive`
 * verdict has been reviewed (and re-checked on later data).
 *
 *   npm run evaluate:external-demand
 *   npm run evaluate:external-demand -- --json
 *
 * Uses the DATABASE_URL of .env.local / .env — possibly PRODUCTION (reads only: categories and paid orders' dates and
 * category). Needs network access to wikimedia.org.
 */
import { readFileSync } from "node:fs"

import { PrismaClient } from "@prisma/client"
import { config } from "dotenv"

import {
  evaluateLeadingIndicator,
  fetchPageviewsDaily,
  weeklyTotals,
  weeksBetween,
} from "../lib/strategic-intelligence/external/wikipedia-demand"

config({ path: ".env.local" })
config({ path: ".env" })

const asJson = process.argv.includes("--json")
const MAX_ORDERS = 300_000
const prisma = new PrismaClient()

type Candidate = { root: number; label: string; articles: Array<{ project: string; title: string }> }

async function main() {
  const { candidates } = JSON.parse(readFileSync("lib/strategic-intelligence/external/wikipedia-candidates.json", "utf8")) as { candidates: Candidate[] }
  // Full weeks only: from the Monday 52 weeks ago to last Sunday.
  const now = new Date()
  const lastSunday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (now.getUTCDay() || 7)))
  const from = new Date(lastSunday.getTime() - (52 * 7 - 1) * 86_400_000)
  const fromDay = from.toISOString().slice(0, 10)
  const toDay = lastSunday.toISOString().slice(0, 10)
  const weeks = weeksBetween(fromDay, toDay)

  const cats = await prisma.category.findMany({ select: { id: true, parentId: true, googleId: true }, take: 100_000 })
  const parent = new Map(cats.map((c) => [c.id, c.parentId]))
  const gid = new Map(cats.map((c) => [c.id, c.googleId]))
  const rootOf = (id: string | null | undefined): number | null => {
    let cur = id ?? null
    let guard = 0
    while (cur && parent.get(cur) && guard++ < 20) cur = parent.get(cur) ?? null
    return cur ? (gid.get(cur) ?? null) : null
  }
  const orders = await prisma.order.findMany({
    where: { paidAt: { gte: from, lt: new Date(lastSunday.getTime() + 86_400_000) } },
    select: { paidAt: true, product: { select: { categoryId: true } } },
    take: MAX_ORDERS,
  })
  if (orders.length >= MAX_ORDERS) throw new Error("echantillon_tronque: too many orders for one read — no conclusion")
  const byRoot = new Map<number, Array<{ date: string; value: number }>>()
  for (const o of orders) {
    const r = rootOf(o.product?.categoryId)
    if (r == null || !o.paidAt) continue
    byRoot.set(r, [...(byRoot.get(r) ?? []), { date: o.paidAt.toISOString().slice(0, 10), value: 1 }])
  }

  const results = []
  for (const c of candidates) {
    const sales = weeklyTotals(byRoot.get(c.root) ?? [])
    for (const a of c.articles) {
      try {
        const daily = await fetchPageviewsDaily(fetch, a.project, a.title, fromDay, toDay)
        if (daily.length === 0) {
          results.push({ root: c.root, label: c.label, article: `${a.project}/${a.title}`, verdict: "article_introuvable", reason: "Aucune donnée (titre inconnu ?)" })
          continue
        }
        const ev = evaluateLeadingIndicator(weeklyTotals(daily.map((d) => ({ date: d.date, value: d.views }))), sales, weeks)
        results.push({ root: c.root, label: c.label, article: `${a.project}/${a.title}`, verdict: ev.verdict, reason: ev.reason, weeks: ev.weeks, orders: ev.orders, lags: ev.lags })
      } catch (error) {
        results.push({ root: c.root, label: c.label, article: `${a.project}/${a.title}`, verdict: "lecture_impossible", reason: error instanceof Error ? error.message : String(error) })
      }
    }
  }
  if (asJson) console.log(JSON.stringify({ from: fromDay, to: toDay, weeks: weeks.length, results }, null, 2))
  else {
    console.log(`Évaluation des indicateurs externes — ${fromDay} → ${toDay} (${weeks.length} semaines, commandes payées réelles)\n`)
    for (const r of results) console.log(`- [${r.verdict}] ${r.label} ← ${r.article} : ${r.reason}`)
    console.log("\nRien n'est écrit ni branché : une source n'entre dans le poste de pilotage qu'après un verdict « predictive » revu.")
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

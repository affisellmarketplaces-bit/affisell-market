import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import {
  ACTIVATION_SEQUENCE,
  ENGINES,
  POST_MIGRATION_CHECKLIST,
  assessEngine,
  buildActivationReadiness,
  etaFor,
  summarizeData,
  type ReadinessFacts,
} from "@/lib/reseller-copilot/activation-readiness"
import { BLIND_SPOT_WINDOW_DAYS, BS_MIN_LISTING_DAYS, BS_MIN_ORDERS, BS_MIN_RESELLERS } from "@/lib/reseller-copilot/blind-spots"
import { TEMPORAL_MIN_RESELLERS, type MeasuredPeriod } from "@/lib/reseller-copilot/temporal-opportunities"
import { RETENTION_TIERS } from "@/lib/reseller-copilot/retention-advisor"
import { PLAN_TIERS } from "@/lib/reseller-copilot/observation-plan"
import { CH_CAP_DAYS, CH_MIN_RESELLERS } from "@/lib/reseller-copilot/contextual-horizon"

const DAY = 86_400_000
const NOW = new Date("2026-11-24T12:00:00Z")
const offModes = { blind_spots: "off", temporal: "off", retention: "off", observation_plan: "off", contextual_horizon: "off" }

const base = (o: Partial<ReadinessFacts> = {}): ReadinessFacts => ({
  now: NOW,
  migrationApplied: false,
  trackingStartedAt: null,
  presenceTruncated: false,
  presenceEvents90d: null,
  unattributedShare: null,
  periods: [],
  unjudgedPeriods: 0,
  markers: { retention: 0, plan: 0, contextualSnapshots: 0 },
  modes: { ...offModes },
  ...o,
})

const period = (productId: string, affiliateId: string, startDaysAgo: number, firstSale: number | null, orders = firstSale === null ? 0 : 1, endDaysAgo: number | null = null): MeasuredPeriod => ({
  productId,
  affiliateId,
  start: NOW.getTime() - startDaysAgo * DAY,
  end: endDaysAgo === null ? null : NOW.getTime() - endDaysAgo * DAY,
  days: startDaysAgo - (endDaysAgo ?? 0),
  orders,
  closedOrders: 0,
  netCents: orders * 500,
  firstSaleAfterDays: firstSale,
  ongoing: endDaysAgo === null,
  isRelisting: false,
  withdrawal: null,
  deleted: false,
})

describe("registry = the engines' own code", () => {
  it("lists the five engines with their real flags and constants (imported, never copied)", () => {
    expect(ENGINES.map((e) => e.flag)).toEqual(["COPILOT_BLIND_SPOTS_MODE", "COPILOT_TEMPORAL_MODE", "OBSERVATION_PLAN_MODE", "RETENTION_ADVISOR_MODE", "CONTEXTUAL_HORIZON_MODE"])
    const bs = ENGINES.find((e) => e.id === "blind_spots")!
    expect(bs.thresholds).toMatchObject({ windowDays: BLIND_SPOT_WINDOW_DAYS, minListingDays: BS_MIN_LISTING_DAYS, minResellers: BS_MIN_RESELLERS, minOrders: BS_MIN_ORDERS })
    expect(ENGINES.find((e) => e.id === "observation_plan")!.thresholds.generalSales).toBe(PLAN_TIERS.general.minSales)
    expect(ENGINES.find((e) => e.id === "retention")!.thresholds.productSales).toBe(RETENTION_TIERS.product.minSales)
    expect(ENGINES.find((e) => e.id === "contextual_horizon")!.thresholds.levelResellers).toBe(CH_MIN_RESELLERS)
    expect(ENGINES.find((e) => e.id === "temporal")!.thresholds.minResellers).toBe(TEMPORAL_MIN_RESELLERS)
  })
  it("every flag reader named here exists in its engine and defaults to off", () => {
    for (const [file, flag] of [
      ["blind-spots", "COPILOT_BLIND_SPOTS_MODE"],
      ["temporal-opportunities", "COPILOT_TEMPORAL_MODE"],
      ["retention-advisor", "RETENTION_ADVISOR_MODE"],
      ["observation-plan", "OBSERVATION_PLAN_MODE"],
      ["contextual-horizon", "CONTEXTUAL_HORIZON_MODE"],
    ]) expect(readFileSync(`lib/reseller-copilot/${file}.ts`, "utf8")).toContain(`env.${flag}`)
  })
  it("only the blind-spot detector has a fallback without the migration", () => {
    expect(ENGINES.filter((e) => !e.requiresPresenceMigration).map((e) => e.id)).toEqual(["blind_spots"])
  })
})

describe("migration not applied (today)", () => {
  const r = buildActivationReadiness(base())
  it("the four history-only engines are Bloqué (0) and never get a duration", () => {
    for (const e of r.engines.filter((x) => x.id !== "blind_spots")) {
      expect(e.level).toBe(0)
      expect(e.state).toBe("bloque")
      expect(e.etaDays).toBeNull()
      expect(e.etaBasis).toMatch(/durée inconnue/)
      expect(e.dimensions.technique).toBe(2)
    }
  })
  it("the blind-spot detector is waiting for data, not blocked, and its volumes are unknown, not zero", () => {
    const bs = r.engines.find((x) => x.id === "blind_spots")!
    expect(bs.state).toBe("en_attente_de_donnees")
    expect(bs.level).toBe(2)
    expect(bs.gaps.every((g) => g.available === null && g.missing === null)).toBe(true)
    expect(bs.etaDays).toBeNull()
  })
  it("no volume is fabricated", () => {
    expect(r.data.periods).toBe(0)
    expect(r.data.salesCadencePerDay).toBeNull()
    expect(r.data.historyDays).toBeNull()
  })
})

describe("data summary and gaps (synthetic)", () => {
  // 40 days of history, 12 resellers, 3 products; product p1 sold by 4 resellers (12 first sales).
  const periods: MeasuredPeriod[] = []
  for (let i = 0; i < 12; i++) periods.push(period("p1", `a${i % 4}`, 35, 5 + i))
  for (let i = 0; i < 12; i++) periods.push(period("p2", `b${i}`, 30, i % 2 ? 8 : null))
  periods.push(period("p3", "c0", 20, null, 0, 10))
  const f = base({ migrationApplied: true, trackingStartedAt: new Date(NOW.getTime() - 40 * DAY), periods, unjudgedPeriods: 3, presenceEvents90d: 120, unattributedShare: 0.1 })
  const d = summarizeData(f)
  it("counts periods, censoring, resellers and the cadence from what was measured", () => {
    expect(d.historyDays).toBe(40)
    expect(d.periods).toBe(25)
    expect(d.firstSales).toBe(18)
    expect(d.censoredShare).toBeCloseTo(7 / 25, 3)
    expect(d.resellers).toBe(4 + 12 + 1)
    expect(d.resellersWithSale).toBe(4 + 6)
    expect(d.salesCadencePerDay).toBeCloseTo(18 / 40, 3)
    expect(d.productsAtProductTier).toBe(1)
    expect(d.coversBlindSpotWindow).toBe(false)
    expect(d.fullyFollowedSales).toBe(0) // nothing followed CH_CAP_DAYS yet
  })
  it("the observation plan's general-tier gap is the engine's own figure", () => {
    const plan = assessEngine(ENGINES.find((e) => e.id === "observation_plan")!, f, d)
    const g = plan.gaps.find((x) => x.metric === "general_tier_first_sales")!
    expect(g).toMatchObject({ required: PLAN_TIERS.general.minSales, available: 18, missing: PLAN_TIERS.general.minSales - 18 })
    expect(plan.state).toBe("en_attente_de_donnees")
    expect(plan.level).toBe(2)
  })
  it("an ETA is given ONLY when every open gap is a sales count with a measured cadence", () => {
    expect(etaFor([{ metric: "general_tier_first_sales", required: 50, available: 18, missing: 32 }], d)).toMatchObject({ etaDays: Math.ceil(32 / d.salesCadencePerDay!) })
    expect(etaFor([{ metric: "resellers_with_sale", required: 10, available: 4, missing: 6 }], d).etaDays).toBeNull()
    expect(etaFor([{ metric: "x_first_sales", required: 50, available: 0, missing: 50 }], { ...d, salesCadencePerDay: null }).etaDays).toBeNull()
  })
  it("the contextual engine needs two followed halves: the calendar is part of its gap", () => {
    const ch = assessEngine(ENGINES.find((e) => e.id === "contextual_horizon")!, f, d)
    expect(ch.gaps.find((g) => g.metric === "history_days_two_followed_halves")).toMatchObject({ required: CH_CAP_DAYS * 2, available: 40, missing: CH_CAP_DAYS * 2 - 40, derived: true })
    expect(ch.state).toBe("en_attente_de_donnees")
  })
  it("collecting (observe) is reported as « collecte », not as ready", () => {
    const ch = assessEngine(ENGINES.find((e) => e.id === "temporal")!, { ...f, modes: { ...offModes, temporal: "observe" } }, d)
    expect(ch.state).toBe("collecte")
  })
  it("a truncated read never counts as data ready", () => {
    const big: MeasuredPeriod[] = []
    for (let i = 0; i < 400; i++) big.push(period(`q${i % 4}`, `r${i % 40}`, 200, 10, 3, null))
    const ff = base({ migrationApplied: true, trackingStartedAt: new Date(NOW.getTime() - 400 * DAY), periods: big, presenceTruncated: true })
    const e = assessEngine(ENGINES.find((x) => x.id === "temporal")!, ff, summarizeData(ff))
    expect(e.dimensions.donnees).toBeLessThan(3)
  })
})

describe("maturity ladder", () => {
  const big: MeasuredPeriod[] = []
  for (let i = 0; i < 400; i++) big.push(period(`q${i % 4}`, `r${i % 40}`, 200, 10, 3))
  for (let i = 0; i < 60; i++) big.push(period(`q${i % 4}`, `s${i % 20}`, 150, null)) // listings that never sold (censored)
  const f = base({ migrationApplied: true, trackingStartedAt: new Date(NOW.getTime() - 400 * DAY), periods: big, markers: { retention: 100, plan: 100, contextualSnapshots: 60 } })
  const d = summarizeData(f)
  it("data ready but not validated = 3, state « validation » — volume alone never validates", () => {
    const e = assessEngine(ENGINES.find((x) => x.id === "contextual_horizon")!, f, d, false)
    expect(e.dimensions.donnees).toBe(3)
    expect(e.level).toBe(3)
    expect(e.state).toBe("validation")
  })
  it("only the engine's own verdict reaches 4, and activation stays a founder decision", () => {
    const e = assessEngine(ENGINES.find((x) => x.id === "contextual_horizon")!, f, d, true)
    expect(e.level).toBe(4)
    expect(e.state).toBe("pret")
    expect(e.nextAction).toMatch(/décision fondateur/)
  })
  it("5 only when every engine before it in the sequence is validated too", () => {
    const alone = buildActivationReadiness(f, { contextual_horizon: true })
    expect(alone.engines.find((x) => x.id === "contextual_horizon")!.level).toBe(4)
    const all = buildActivationReadiness(f, { temporal: true, blind_spots: true, observation_plan: true, retention: true, contextual_horizon: true })
    expect(all.engines.every((x) => x.level === 5)).toBe(true)
  })
  it("a validation claimed without ready data never lifts the level above 2", () => {
    const thin = base({ migrationApplied: true, trackingStartedAt: new Date(NOW.getTime() - 20 * DAY), periods: [period("p", "a", 10, 3)] })
    for (const s of ENGINES) expect(assessEngine(s, thin, summarizeData(thin), true).level).toBeLessThanOrEqual(2)
  })
})

describe("activation sequence and checklist", () => {
  it("collection (migration) comes first and alone, then one flag per step", () => {
    expect(ACTIVATION_SEQUENCE[0].flag).toBeNull()
    expect(ACTIVATION_SEQUENCE.slice(1, 6).map((s) => s.flag)).toEqual(["COPILOT_TEMPORAL_MODE", "COPILOT_BLIND_SPOTS_MODE", "OBSERVATION_PLAN_MODE", "RETENTION_ADVISOR_MODE", "CONTEXTUAL_HORIZON_MODE"])
    expect(ACTIVATION_SEQUENCE.slice(1, 6).every((s) => s.value === "observe")).toBe(true)
    for (const s of ACTIVATION_SEQUENCE) expect(s.rollback.length).toBeGreaterThan(10)
  })
  it("showing anything to resellers is the last step, with a control group, one engine at a time", () => {
    const last = ACTIVATION_SEQUENCE[ACTIVATION_SEQUENCE.length - 1]
    expect(last.value).toMatch(/on/)
    expect(last.value).toMatch(/HOLDOUT/)
    expect(last.gate.join(" ")).toMatch(/décision fondateur distincte/)
  })
  it("the post-migration checklist has the 12 steps and ends on a separate activation decision", () => {
    expect(POST_MIGRATION_CHECKLIST.map((s) => s.step)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(POST_MIGRATION_CHECKLIST[11].title).toMatch(/séparée/)
  })
})

describe("confidentiality and read-only", () => {
  it("the report carries aggregates only — no product or reseller identifier", () => {
    const periods = [period("prod-SECRET", "aff-SECRET", 30, 4)]
    const r = buildActivationReadiness(base({ migrationApplied: true, trackingStartedAt: new Date(NOW.getTime() - 30 * DAY), periods }))
    const json = JSON.stringify(r)
    expect(json).not.toContain("prod-SECRET")
    expect(json).not.toContain("aff-SECRET")
  })
  it("pure module reads nothing; server writes nothing and never recomputes the contextual bundle", () => {
    expect(readFileSync("lib/reseller-copilot/activation-readiness.ts", "utf8")).not.toMatch(/prisma|fetch\(|server-only/)
    const srv = readFileSync("lib/reseller-copilot/activation-readiness.server.ts", "utf8")
    expect(srv).not.toMatch(/\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(|\$executeRaw/)
    expect(srv).not.toMatch(/loadContextualBundle|loadContextualAdminView|recordPlansAfterAdd/)
    expect(srv).not.toMatch(/process\.env\.[A-Z_]+\s*=/)
  })
  it("served by the existing ADMIN route only, behind ?readiness=1", () => {
    const route = readFileSync("app/api/admin/copilot-blind-spots/route.ts", "utf8")
    expect(route).toMatch(/requireAdminSession\(\)/)
    expect(route).toMatch(/searchParams\.get\("readiness"\) === "1"/)
  })
})

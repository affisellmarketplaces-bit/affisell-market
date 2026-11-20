import type { ElasticityPool } from "@/lib/strategic-intelligence/demand-adjusted-simulation"
import { PR_MODEL_VERSION, PR_WINDOW_DAYS, type RecordedEstimate } from "@/lib/strategic-intelligence/price-response"

/**
 * The price-sensitivity forecast journal — pure part (what a recorded forecast contains, when one is written, how it is
 * read back). Server part: price-estimate-history.server.ts.
 *
 * A record IS a forecast: « for any reseller price change made after `dataCutoff`, the log change of that listing's
 * paid orders vs the same product's other listings over the next `horizonDays` days is expected to be
 * mean × ln(p1/p0), with the stated uncertainty ». It keeps: its date, the model version, the data it was built from
 * (cutoff, number of changes, products, resellers, last change), its horizon and that expected result. Aggregates only:
 * no listing, product, reseller, buyer or order identifier — the pool key is « marketplace » or a taxonomy root id.
 *
 * Written only when there is something NEW to forecast: a pool whose latest record has the same model version and
 * was built from the same data (same number of changes, same last change, same cutoff) is not written again, so a day
 * without new price changes adds no row.
 */
export const PRICE_ESTIMATE_PAYLOAD_KEYS = [
  "modelVersion",
  "recordedAt",
  "dataCutoff",
  "horizonDays",
  "eventsUsed",
  "products",
  "resellers",
  "lastEventAt",
  "mean",
  "se",
  "tau2",
  "predLo",
  "predHi",
  "grade",
  "expected",
] as const

export type PriceEstimatePayload = {
  modelVersion: string
  recordedAt: string
  dataCutoff: string
  horizonDays: number
  eventsUsed: number
  products: number
  resellers: number | null
  lastEventAt: string
  mean: number
  se: number
  tau2: number
  predLo: number | null
  predHi: number | null
  grade: string
  expected: string
}

export function priceEstimatePayload(p: ElasticityPool, now: Date): PriceEstimatePayload {
  return {
    modelVersion: PR_MODEL_VERSION,
    recordedAt: now.toISOString(),
    dataCutoff: p.dataCutoff,
    horizonDays: PR_WINDOW_DAYS,
    eventsUsed: p.n,
    products: p.products,
    resellers: p.resellers,
    lastEventAt: p.lastAt,
    mean: p.elasticity,
    se: p.se,
    tau2: p.tau2,
    predLo: p.predLo,
    predHi: p.predHi,
    grade: p.grade,
    expected: "log_orders_vs_controls = mean × ln(p1/p0)",
  }
}

/** Same version and same data as the latest record of the pool = nothing new to forecast. */
export function isNewForecast(candidate: PriceEstimatePayload, latest: Pick<PriceEstimatePayload, "modelVersion" | "dataCutoff" | "eventsUsed" | "lastEventAt"> | null): boolean {
  if (!latest) return true
  return !(
    latest.modelVersion === candidate.modelVersion &&
    latest.dataCutoff === candidate.dataCutoff &&
    latest.eventsUsed === candidate.eventsUsed &&
    latest.lastEventAt === candidate.lastEventAt
  )
}

/** Parses one stored payload; anything malformed — or written by an older format without version / cutoff — is ignored
 * (never trusted as a number, never scored). */
export function parseRecordedEstimate(poolKey: string, payload: unknown): (RecordedEstimate & { eventsUsed: number; lastEventAt: string }) | null {
  if (!payload || typeof payload !== "object") return null
  const p = payload as Record<string, unknown>
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null)
  const date = (v: unknown) => (typeof v === "string" && !Number.isNaN(new Date(v).getTime()) ? new Date(v) : null)
  const mean = num(p.mean), se = num(p.se), tau2 = num(p.tau2), eventsUsed = num(p.eventsUsed)
  const recordedAt = date(p.recordedAt), dataCutoff = date(p.dataCutoff)
  const modelVersion = typeof p.modelVersion === "string" ? p.modelVersion : null
  const lastEventAt = typeof p.lastEventAt === "string" ? p.lastEventAt : null
  if (mean === null || se === null || se < 0 || tau2 === null || tau2 < 0 || eventsUsed === null || !recordedAt || !dataCutoff || !modelVersion || !lastEventAt) return null
  if (dataCutoff.getTime() > recordedAt.getTime()) return null // a forecast can not have used data from after it was made
  return { poolKey, modelVersion, recordedAt, dataCutoff, mean, se, tau2, eventsUsed, lastEventAt }
}

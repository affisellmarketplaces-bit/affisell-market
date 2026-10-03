/**
 * Measured supplier delivery performance — pure maths + display rules (no Prisma, client-safe).
 *
 * Inputs are carrier-attested deliveries only (`Order.deliveredAt` is written solely through the AfterShip webhook gate),
 * so a supplier cannot flatter these numbers: they are what buyers actually experienced.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** Rolling window the stats cover. */
export const DELIVERY_STATS_WINDOW_DAYS = 180
/** Most recent deliveries kept per supplier (bounds the query and keeps the stat current). */
export const DELIVERY_STATS_MAX_SAMPLE = 200
/** Below this many measured deliveries we show nothing measured (a median of 3 orders is an anecdote, not a promise). */
export const DELIVERY_STATS_MIN_PROVEN_SAMPLE = 10
/** Deliveries slower than this are data errors / lost-and-found parcels, not a typical experience. */
const MAX_PLAUSIBLE_END_TO_END_DAYS = 120

export type DeliveryObservation = {
  paidAt: Date | string
  shippedAt?: Date | string | null
  deliveredAt: Date | string
}

export type SupplierDeliveryStatsValues = {
  sampleSize: number
  medianDispatchDays: number | null
  medianEndToEndDays: number | null
  p90EndToEndDays: number | null
}

function toMs(value: Date | string | null | undefined): number | null {
  if (value == null) return null
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(ms) ? ms : null
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Linear-interpolation percentile over an ASCENDING array. `p` in [0,1]. */
export function percentile(sortedAsc: readonly number[], p: number): number | null {
  if (sortedAsc.length === 0) return null
  if (sortedAsc.length === 1) return sortedAsc[0]!
  const rank = Math.min(1, Math.max(0, p)) * (sortedAsc.length - 1)
  const lo = Math.floor(rank)
  const hi = Math.ceil(rank)
  const a = sortedAsc[lo]!
  const b = sortedAsc[hi]!
  return a + (b - a) * (rank - lo)
}

/**
 * Median dispatch (paid → shipped), median and 90th-percentile end-to-end (paid → delivered) in days, 1 decimal.
 * Observations with impossible or implausible timestamps are ignored (and not counted in `sampleSize`).
 */
export function summarizeDeliveryObservations(
  observations: readonly DeliveryObservation[]
): SupplierDeliveryStatsValues {
  const endToEnd: number[] = []
  const dispatch: number[] = []

  for (const o of observations) {
    const paid = toMs(o.paidAt)
    const delivered = toMs(o.deliveredAt)
    if (paid == null || delivered == null || delivered < paid) continue
    const days = (delivered - paid) / DAY_MS
    if (days > MAX_PLAUSIBLE_END_TO_END_DAYS) continue
    endToEnd.push(days)

    const shipped = toMs(o.shippedAt)
    if (shipped != null && shipped >= paid && shipped <= delivered) dispatch.push((shipped - paid) / DAY_MS)
  }

  endToEnd.sort((a, b) => a - b)
  dispatch.sort((a, b) => a - b)
  const med = (arr: number[]) => {
    const v = percentile(arr, 0.5)
    return v == null ? null : round1(v)
  }
  const p90 = percentile(endToEnd, 0.9)

  return {
    sampleSize: endToEnd.length,
    medianDispatchDays: med(dispatch),
    medianEndToEndDays: med(endToEnd),
    p90EndToEndDays: p90 == null ? null : round1(p90),
  }
}

/** Stats a buyer may be shown: enough measured deliveries and complete figures. */
export type ProvenDeliveryStats = {
  sampleSize: number
  /** Whole days, rounded up — never understate what a buyer might wait. */
  medianEndToEndDays: number
  /** "9 orders out of 10 delivered within …" — whole days, rounded up. */
  p90EndToEndDays: number
  /** Whole days (nearest); null when too few orders carried a shipping timestamp. */
  medianDispatchDays: number | null
}

export function toProvenDeliveryStats(
  stats: SupplierDeliveryStatsValues | null | undefined,
  minSample = DELIVERY_STATS_MIN_PROVEN_SAMPLE
): ProvenDeliveryStats | null {
  if (!stats || stats.sampleSize < minSample) return null
  if (stats.medianEndToEndDays == null || stats.p90EndToEndDays == null) return null
  const median = Math.max(1, Math.ceil(stats.medianEndToEndDays))
  const p90 = Math.max(median, Math.ceil(stats.p90EndToEndDays))
  return {
    sampleSize: stats.sampleSize,
    medianEndToEndDays: median,
    p90EndToEndDays: p90,
    medianDispatchDays: stats.medianDispatchDays == null ? null : Math.max(0, Math.round(stats.medianDispatchDays)),
  }
}

/**
 * Compares what a supplier DECLARES (processing + max transit) with what buyers measured at the 90th percentile.
 * `optimistic` = 9 in 10 orders arrive later than the declared window by more than a day of slack.
 */
export function compareDeclaredToMeasured(
  declared: { processingDays: number; deliveryMaxDays: number },
  proven: ProvenDeliveryStats | null
): { declaredTotalDays: number; measuredP90Days: number; deltaDays: number; optimistic: boolean } | null {
  if (!proven) return null
  const declaredTotalDays = Math.max(1, Math.round(declared.processingDays) + Math.round(declared.deliveryMaxDays))
  const deltaDays = proven.p90EndToEndDays - declaredTotalDays
  return {
    declaredTotalDays,
    measuredP90Days: proven.p90EndToEndDays,
    deltaDays,
    optimistic: deltaDays > 1,
  }
}

/**
 * Refresh order for the time-boxed cron: suppliers never measured first, then the stalest. Stable for equal keys.
 */
export function orderSuppliersForStatsRefresh(
  supplierIds: readonly string[],
  computedAtBySupplier: ReadonlyMap<string, Date | string>
): string[] {
  const keyOf = (id: string) => {
    const at = computedAtBySupplier.get(id)
    if (at == null) return Number.NEGATIVE_INFINITY
    const ms = toMs(at)
    return ms == null ? Number.NEGATIVE_INFINITY : ms
  }
  return [...supplierIds]
    .map((id, index) => ({ id, index, key: keyOf(id) }))
    .sort((a, b) => (a.key === b.key ? a.index - b.index : a.key < b.key ? -1 : 1))
    .map((x) => x.id)
}

/**
 * What a supplier typically PROMISES across their live listings: median of (processing + max transit) days.
 * Null when there is nothing declared.
 */
export function typicalDeclaredTotalDays(
  products: readonly { processingTime?: number | null; deliveryMax?: number | null }[]
): { processingDays: number; deliveryMaxDays: number; totalDays: number } | null {
  const totals: { processing: number; max: number }[] = []
  for (const p of products) {
    const processing = Number(p.processingTime)
    const max = Number(p.deliveryMax)
    if (!Number.isFinite(processing) || !Number.isFinite(max) || processing < 0 || max < 1) continue
    totals.push({ processing: Math.round(processing), max: Math.round(max) })
  }
  if (totals.length === 0) return null
  totals.sort((a, b) => a.processing + a.max - (b.processing + b.max))
  const mid = totals[Math.floor((totals.length - 1) / 2)]!
  return { processingDays: mid.processing, deliveryMaxDays: mid.max, totalDays: mid.processing + mid.max }
}

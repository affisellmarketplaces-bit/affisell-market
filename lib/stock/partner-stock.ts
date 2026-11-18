/**
 * Product lifecycle (founder decision 2026-11-18): publication (`isDraft`), commercial status (`active`) and
 * availability (`stock`) are independent. A stock source — a partner API, a probe — writes the AVAILABILITY axis only.
 */

/** A partner count as a stock value: whole, never negative; anything unreadable counts as 0 (sold out, still listed). */
export function partnerStockValue(raw: unknown): number {
  const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : Number.NaN
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.floor(n)
}

/** The only product fields a stock sync may write. `active` and `isDraft` are deliberately absent. */
export function partnerStockUpdate(raw: unknown): { stock: number } {
  return { stock: partnerStockValue(raw) }
}

/**
 * What a supplier form save writes to `Product.stock` (chantier 2 — sold units are never resurrected).
 *
 * The form sends the stock it shows (`submitted`) and the stock it LOADED from the server (`baseline`). Between the two,
 * sales may have decremented the stock (CHECKOUT_STOCK_MODE=enforce). Rules:
 * - submitted unreadable → keep the current stock (no write);
 * - baseline sent and submitted === baseline → the supplier did not touch the stock: keep the current stock (a save of
 *   the title or the photos used to write the loaded value back and resurrect the units sold meanwhile);
 * - baseline sent and different → apply the supplier's CHANGE (submitted − baseline) to the current stock, never below 0;
 * - no baseline (legacy client, API caller) → the submitted value, as before.
 */
export function resolveSupplierStockWrite(input: { current: number; submitted: unknown; baseline: unknown }): number {
  const current = Math.max(0, Math.round(Number.isFinite(input.current) ? input.current : 0))
  const submitted = toFiniteNumber(input.submitted)
  if (submitted == null) return current
  const target = Math.max(0, Math.round(submitted))
  const baselineRaw = toFiniteNumber(input.baseline)
  if (baselineRaw == null) return target
  const baseline = Math.max(0, Math.round(baselineRaw))
  if (target === baseline) return current
  return Math.max(0, current + (target - baseline))
}

function toFiniteNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }
  return null
}

type StockRow = { id?: unknown; name?: unknown; stock?: unknown }

function rowKey(row: StockRow): string | null {
  if (typeof row.id === "string" && row.id.trim()) return `id:${row.id.trim()}`
  if (typeof row.name === "string" && row.name.trim()) return `name:${row.name.trim().toLowerCase()}`
  return null
}

/**
 * Same rule as `resolveSupplierStockWrite`, row by row, for the advanced SKU table (`variants.variantRows[].stock`):
 * the form sends each row's stock as it loaded it (`baseline`, keyed by row id — `id:<id>` — else name — `name:<name>`).
 * An untouched row keeps its CURRENT stock (sales decrement the row in enforce mode); a changed row gets the
 * supplier's change on top; a row unknown to the server (new SKU) or without a baseline takes the submitted value.
 * Returns the rows to store and their total, which becomes `Product.stock` (the sum the PDP reads).
 */
export function mergeVariantRowStocks<R extends StockRow>(args: {
  existingRows: ReadonlyArray<StockRow>
  incomingRows: ReadonlyArray<R>
  baseline: Readonly<Record<string, unknown>> | null | undefined
}): { rows: Array<R & { stock: number }>; total: number } {
  // Existing rows by id, and by name when that name is unique. A row whose id changed between two saves (a row
  // first saved as `new-…` and later reloaded from the ProductVariant table with its database id) is still the
  // same SKU: it is found by its name, and its baseline is read under the key the form loaded it with.
  const byId = new Map<string, { key: string; stock: number }>()
  const byName = new Map<string, { key: string; stock: number } | null>()
  for (const row of args.existingRows) {
    const key = rowKey(row)
    const n = Number(row.stock)
    if (!key || !Number.isFinite(n)) continue
    const entry = { key, stock: Math.max(0, Math.round(n)) }
    const id = idOf(row)
    if (id) byId.set(id, entry)
    const name = nameOf(row)
    if (name) byName.set(name, byName.has(name) ? null : entry)
  }
  const incomingNames = new Map<string, number>()
  for (const row of args.incomingRows) {
    const name = nameOf(row)
    if (name) incomingNames.set(name, (incomingNames.get(name) ?? 0) + 1)
  }
  const rows = args.incomingRows.map((row) => {
    const id = idOf(row)
    const name = nameOf(row)
    const match =
      (id ? byId.get(id) : undefined) ??
      (name && incomingNames.get(name) === 1 ? byName.get(name) ?? undefined : undefined)
    const ownKey = rowKey(row)
    const baselineRaw =
      match && args.baseline
        ? args.baseline[match.key] ?? (ownKey ? args.baseline[ownKey] : undefined)
        : undefined
    const stock = resolveSupplierStockWrite({
      current: match ? match.stock : 0,
      submitted: row.stock,
      baseline: baselineRaw,
    })
    return { ...row, stock }
  })
  return { rows, total: rows.reduce((acc, r) => acc + r.stock, 0) }
}

/**
 * The ProductVariant TABLE rows a form sends with the advanced SKU table (`variants`, written by
 * `syncProductVariants`, which then sets `Product.stock` to the table's sum). Checkout decrements the JSON rows
 * (`Product.variants.variantRows`), never the table, so writing the table from the submitted values put the units
 * sold meanwhile back into `Product.stock`. Each table row takes the stock of the merged JSON row of the same SKU
 * (same id, else the same unique label "color / size"); a table row with no JSON counterpart keeps the submitted
 * value (nothing ever decremented it). `aligned` counts the rows that were matched.
 */
export function alignTableVariantStocks<
  T extends { id?: string | null; color: string; size?: string | null; stock: number },
>(
  tableRows: ReadonlyArray<T>,
  mergedRows: ReadonlyArray<StockRow & { stock: number }>,
  labelOf: (color: string, size: string | null | undefined) => string
): { rows: T[]; aligned: number } {
  const byId = new Map<string, number>()
  const byName = new Map<string, number | null>()
  for (const row of mergedRows) {
    const id = idOf(row)
    if (id) byId.set(id, row.stock)
    const name = nameOf(row)
    if (name) byName.set(name, byName.has(name) ? null : row.stock)
  }
  let aligned = 0
  const rows = tableRows.map((row) => {
    const id = typeof row.id === "string" && row.id.trim() ? row.id.trim() : null
    const label = labelOf(row.color, row.size).trim().toLowerCase()
    const stock = (id ? byId.get(id) : undefined) ?? (label ? byName.get(label) ?? undefined : undefined)
    if (stock == null) return row
    aligned += 1
    return { ...row, stock }
  })
  return { rows, aligned }
}

function idOf(row: StockRow): string | null {
  return typeof row.id === "string" && row.id.trim() ? row.id.trim() : null
}

function nameOf(row: StockRow): string | null {
  return typeof row.name === "string" && row.name.trim() ? row.name.trim().toLowerCase() : null
}

/** The baseline key of a variant row, as the form must send it (`variantStockBaseline`). */
export function variantStockBaselineKey(row: StockRow): string | null {
  return rowKey(row)
}

/** The `variantStockBaseline` a form sends: each row's stock as it loaded it, keyed like the server merges. */
export function variantStockBaselineFromRows(rows: unknown): Record<string, number> | null {
  if (!Array.isArray(rows) || rows.length === 0) return null
  const out: Record<string, number> = {}
  for (const row of rows) {
    if (!row || typeof row !== "object") continue
    const key = rowKey(row as StockRow)
    const n = Number((row as StockRow).stock)
    if (key && Number.isFinite(n)) out[key] = Math.max(0, Math.round(n))
  }
  return Object.keys(out).length > 0 ? out : null
}

/**
 * Preparing the scheduling of `sync-stock` (founder decision pending): what ONE partner stock row may write.
 * - an unreadable partner value (empty, text, NaN) is a TECHNICAL failure: nothing is written (writing 0 would show
 *   the product sold out because of an API glitch — the lifecycle rule says a technical failure never changes a state);
 * - a product whose stock lives in advanced SKU rows (`variants.variantRows`) is skipped: `Product.stock` is their SUM,
 *   a product-level partner count would desynchronise them (a per-row SKU mapping is the follow-up);
 * - an unchanged value writes nothing.
 */
export type PartnerStockPlan =
  | { action: "write"; stock: number }
  | { action: "skip"; reason: "unreadable" | "variant_rows" | "unchanged" }

export function planPartnerStockWrite(raw: unknown, current: { stock: number; variants: unknown }): PartnerStockPlan {
  const readable =
    (typeof raw === "number" && Number.isFinite(raw)) ||
    (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw)))
  if (!readable) return { action: "skip", reason: "unreadable" }
  const rows = (current.variants as { variantRows?: unknown } | null)?.variantRows
  if (Array.isArray(rows) && rows.length > 0) return { action: "skip", reason: "variant_rows" }
  const stock = partnerStockValue(raw)
  if (stock === current.stock) return { action: "skip", reason: "unchanged" }
  return { action: "write", stock }
}

/** `PARTNER_STOCK_SYNC_MODE`: `off` | `observe` (DEFAULT — computes and logs, writes nothing) | `enforce`. */
export type PartnerStockSyncMode = "off" | "observe" | "enforce"
export function resolvePartnerStockSyncMode(env: Record<string, string | undefined> = process.env): PartnerStockSyncMode {
  const v = env.PARTNER_STOCK_SYNC_MODE?.trim().toLowerCase()
  if (v === "off") return "off"
  if (v === "enforce") return "enforce"
  return "observe"
}

/**
 * Observation summary of a `sync-stock` run (protocol: docs/ENFORCE-READINESS-CRITERIA.md §5). What a reviewer needs
 * to judge a week of `observe` without reading every line: how many writes WOULD happen, how many would put a product
 * at 0 (the risky ones), how many would bring one back from 0, how many are large jumps, and why the others are skipped.
 */
export type PartnerStockObservation = {
  wouldWrite: number
  toZero: number
  fromZero: number
  largeChange: number
  skipped: Record<"unreadable" | "variant_rows" | "unchanged", number>
}

export function emptyPartnerStockObservation(): PartnerStockObservation {
  return { wouldWrite: 0, toZero: 0, fromZero: 0, largeChange: 0, skipped: { unreadable: 0, variant_rows: 0, unchanged: 0 } }
}

/** A change is "large" when it moves the stock by more than half AND by at least 10 units. */
export function recordPartnerStockPlan(obs: PartnerStockObservation, current: number, plan: PartnerStockPlan): void {
  if (plan.action === "skip") {
    obs.skipped[plan.reason] += 1
    return
  }
  obs.wouldWrite += 1
  if (plan.stock === 0 && current > 0) obs.toZero += 1
  if (current === 0 && plan.stock > 0) obs.fromZero += 1
  const delta = Math.abs(plan.stock - current)
  if (delta >= 10 && delta > Math.max(current, 1) / 2) obs.largeChange += 1
}

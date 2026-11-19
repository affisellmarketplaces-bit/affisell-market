/**
 * ONE rule for « which variant is the buyer buying? » (founder brief 2026-11-19 « Finalisation de la fiabilité des
 * déclinaisons »), shared by the stock decrement, the check before payment, the product pages (marketplace, reseller
 * boutique) and the card « buy » buttons. Pure and client-safe (no I/O).
 *
 * What a variant IS in Affisell: a row of `Product.variants.variantRows` (the advanced SKU table — the only variant
 * stock checkout reads and writes). A row carries up to three dimensions:
 *  - colour  = the part of its name before the first « / »;
 *  - size    = the part after it (any further « / » part is an unnamed extra dimension, `other`);
 *  - storage = its storage attribute (`attrs[<storage column>]`, e.g. « 128 Go »), when the product has one.
 *
 * The buyer's choice names some of those dimensions. The rule:
 *  - every dimension the buyer named must match the row (normalised: case, accents of width, spaces);
 *  - the « size » the transaction carries may be a storage value: the product page sends its capacity in the size slot
 *    when the product has no size (`cartSelectedSize = size ?? storage`), so a size value that NO row has as a size is
 *    matched against the storage dimension instead — never both at once;
 *  - 0 rows match  → `unknown`   (the combination does not exist: never sold);
 *  - 1 row matches → `resolved`  (the buyer bought THAT row — with no choice at all only when the product has a single
 *    row: nothing else could be bought);
 *  - more rows     → `incomplete` with the dimensions that still differ between them (a colour alone on a product
 *    sold in several sizes) — Affisell never picks a size or a colour for the buyer, and never reads « one of them has
 *    stock » as « available »;
 *  - rows identical on every dimension → `duplicate_rows`: the supplier's data, not the buyer's choice, is at fault;
 *    it is never refused here and never decremented (no row can be told apart).
 * Products without rows (no variants, or variants kept only in the `ProductVariant` table) are `no_rows`: their stock
 * is not held per variant, so nothing here judges them — see `requiresVariantChoice` for whether the buyer must still
 * pick before buying.
 */
/** Same prefix rule as `stripVariantOptionTypePrefix` (supplier SKU builder) — kept here so this module has NO import
 * (it is read by the read-only report scripts, which resolve relative imports only). Pinned equal by a test. */
function stripOptionTypePrefix(label: string): string {
  const trimmed = label.trim()
  const stripped = trimmed.replace(/^(color|couleur|colour|size|taille)\s*:\s*/i, "").trim()
  return stripped || trimmed
}

export type VariantDimension = "color" | "size" | "storage" | "other"

export type VariantChoice = {
  color?: string | null
  size?: string | null
  storage?: string | null
}

export type VariantChoiceResolution =
  | { kind: "no_rows" }
  | { kind: "resolved"; index: number; auto: boolean }
  | { kind: "incomplete"; missing: VariantDimension[]; candidates: number[] }
  | { kind: "unknown" }
  | { kind: "duplicate_rows"; candidates: number[] }

const STORAGE_KEY_RE = /(?:^|_)(storage|stockage|capacite|capacity|memoire|memory|rom|ssd|carte_sd)(?:_|$)/i
const STORAGE_LABEL_RE = /stockage|storage|capacit|mémoire|memoire|memory|\bgo\b|\bgb\b|\btb\b|carte\s*sd/i

/** Is this custom column the « storage / capacity » dimension? (shared with the product pages' pickers) */
export function isStorageCustomColumn(col: { key: string; label: string }): boolean {
  return STORAGE_KEY_RE.test(col.key) || STORAGE_LABEL_RE.test(col.label)
}

type RawColumn = { key?: unknown; label?: unknown }

function asColumns(v: unknown): Array<{ key: string; label: string }> {
  if (!Array.isArray(v)) return []
  return v
    .filter((c): c is RawColumn => Boolean(c) && typeof c === "object")
    .map((c) => ({ key: typeof c.key === "string" ? c.key : "", label: typeof c.label === "string" ? c.label : "" }))
    .filter((c) => c.key)
}

type RawRow = { name: string; attrs: Record<string, unknown> | null; stock: number }

function rawRows(variants: unknown): RawRow[] {
  const rows = (variants as { variantRows?: unknown } | null)?.variantRows
  if (!Array.isArray(rows)) return []
  return rows
    .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object")
    .map((r) => ({
      stock: Number.isFinite(Number(r.stock)) ? Math.max(0, Math.round(Number(r.stock))) : 0,
      name: typeof r.name === "string" ? r.name : "",
      attrs: r.attrs && typeof r.attrs === "object" && !Array.isArray(r.attrs) ? (r.attrs as Record<string, unknown>) : null,
    }))
}

/** The attribute key that holds the storage dimension, or null when the product has none. */
export function storageKeyOf(variants: unknown, customColumns?: unknown): string | null {
  const meta = [...asColumns(customColumns), ...asColumns((variants as { skuCustomColumns?: unknown } | null)?.skuCustomColumns)]
  for (const c of meta) if (isStorageCustomColumn(c)) return c.key
  for (const r of rawRows(variants)) {
    for (const k of Object.keys(r.attrs ?? {})) if (STORAGE_KEY_RE.test(k)) return k
  }
  return null
}

export function normVariantValue(s: string | null | undefined): string {
  return (s ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase()
}

/** `other` = any name part after the second « / » (an imported row « Noir / M / Coton »): a dimension the pickers do
 * not name, so a choice can never complete it — a product whose rows differ only there is `incomplete`, never guessed. */
export type VariantRowDims = { color: string; size: string; storage: string; other: string }

/** The three dimensions of every row, normalised (empty string = the row does not have that dimension). */
export function variantRowDimensions(variants: unknown, customColumns?: unknown): VariantRowDims[] {
  const key = storageKeyOf(variants, customColumns)
  return rawRows(variants).map((r) => {
    const parts = r.name.split(" / ").map((p) => stripOptionTypePrefix(p))
    const storage = key && r.attrs?.[key] != null ? String(r.attrs[key]) : ""
    return {
      color: normVariantValue(parts[0]),
      size: normVariantValue(parts[1]),
      storage: normVariantValue(storage),
      other: normVariantValue(parts.slice(2).join(" / ")),
    }
  })
}

export function resolveVariantChoice(variants: unknown, choice: VariantChoice, customColumns?: unknown): VariantChoiceResolution {
  const dims = variantRowDimensions(variants, customColumns)
  if (dims.length === 0) return { kind: "no_rows" }
  const c = normVariantValue(choice.color)
  const s = normVariantValue(choice.size)
  const g = normVariantValue(choice.storage)
  // The size slot carries a capacity when the product has no such size (see the header): decided ONCE, not per row.
  const sizeIsStorage = Boolean(s) && !g && !dims.some((d) => d.size === s) && dims.some((d) => d.storage === s)
  const wantSize = sizeIsStorage ? "" : s
  const wantStorage = sizeIsStorage ? s : g
  const candidates: number[] = []
  dims.forEach((d, i) => {
    if (c && d.color !== c) return
    if (wantSize && d.size !== wantSize) return
    if (wantStorage && d.storage !== wantStorage) return
    candidates.push(i)
  })
  const named = Boolean(c || wantSize || wantStorage)
  if (candidates.length === 0) return { kind: "unknown" }
  if (candidates.length === 1) return { kind: "resolved", index: candidates[0]!, auto: !named }
  const missing: VariantDimension[] = []
  const varies = (pick: (d: VariantRowDims) => string) => new Set(candidates.map((i) => pick(dims[i]!))).size > 1
  if (varies((d) => d.color)) missing.push("color")
  if (varies((d) => d.size)) missing.push("size")
  if (varies((d) => d.storage)) missing.push("storage")
  if (varies((d) => d.other)) missing.push("other")
  if (missing.length === 0) return { kind: "duplicate_rows", candidates }
  return { kind: "incomplete", missing, candidates }
}

/**
 * Must the buyer pick before buying (card « buy » / « add » buttons, product pages)? True when the rows leave more than
 * one possibility with no choice, AND for a product whose variants exist only in the `ProductVariant` table (≥ 2 of
 * them): its stock is not held per variant, but an order without a size / colour would still not tell the supplier
 * what to send. Pure.
 */
export function requiresVariantChoice(args: {
  variants: unknown
  customColumns?: unknown
  /** The `ProductVariant` table rows (judged with the same rule when there are no advanced rows). */
  tableVariants?: ReadonlyArray<TableVariant> | null
  /** Only a count is known: ≥ 2 table variants = a choice is needed (cannot tell identical ones apart). */
  tableVariantCount?: number
}): boolean {
  const rows = rowsForChoice(args.variants, args.tableVariants, args.customColumns)
  const r = resolveVariantChoice(rows, {}, args.customColumns)
  if (r.kind === "incomplete") return true
  if (r.kind === "no_rows") return (args.tableVariantCount ?? 0) >= 2
  return false
}

/**
 * Stock to show on ONE option chip (a size, a capacity) given what is already chosen — the same rule as the purchase.
 * The chip names a combination: it is sold out when that combination does not exist (`unknown` → 0) or when every row
 * it can still be has 0; while another dimension is still to choose, it is available as soon as one of them has stock
 * (the chip does not buy: completing the choice is required before « buy »). `null` = the product has no rows (its
 * stock is not held per variant: the caller keeps its product-level figure, nothing is invented). Pure.
 */
export function optionStockForChoice(variants: unknown, choice: VariantChoice, customColumns?: unknown): number | null {
  const r = resolveVariantChoice(variants, choice, customColumns)
  if (r.kind === "no_rows") return null
  if (r.kind === "unknown") return 0
  const rows = rawRows(variants)
  const idx = r.kind === "resolved" ? [r.index] : r.candidates
  return idx.reduce((sum, i) => sum + (rows[i]?.stock ?? 0), 0)
}

/**
 * Rows a buyer can NOT tell apart with the pickers: same colour, size and capacity (a duplicated line, or rows that
 * differ only by an unnamed third name part). Those rows are never decremented and can not be bought precisely — the
 * supplier's sheet must name them differently. Returns how many rows are concerned and a few of their names. Pure.
 */
export function indistinctVariantRows(variants: unknown, customColumns?: unknown): { rows: number; labels: string[] } {
  const dims = variantRowDimensions(variants, customColumns)
  const names = rawRows(variants).map((r) => r.name.trim())
  const groups = new Map<string, number[]>()
  dims.forEach((d, i) => {
    const key = `${d.color}\u0001${d.size}\u0001${d.storage}`
    groups.set(key, [...(groups.get(key) ?? []), i])
  })
  const involved = [...groups.values()].filter((g) => g.length > 1).flat()
  return { rows: involved.length, labels: [...new Set(involved.map((i) => names[i] || "—"))].slice(0, 3) }
}

// ---------------------------------------------------------------------------------------------------------------
// Variants kept in the separate `ProductVariant` table (no `variantRows` json) — founder brief 2026-11-19 §2.
// ---------------------------------------------------------------------------------------------------------------

/** One row of the `ProductVariant` table, as read for a choice check (no price, no identifier needed). */
export type TableVariant = {
  color?: string | null
  size?: string | null
  stock?: number | null
  /** Extra columns (capacity…), `{ key: value }` as the table stores them. */
  customData?: unknown
}

/**
 * The table's variants seen through the SAME rule as the advanced rows: name « colour / size » (a size alone keeps its
 * size slot, never read as a colour), capacity and other columns as attributes, the table's own stock. Only used to
 * JUDGE a choice and its availability — checkout never decrements this table (AGENTS.md): nothing here writes.
 * `null` when the table has no variant. Pure.
 */
export function variantsFromTable(table: ReadonlyArray<TableVariant> | null | undefined, customColumns?: unknown): {
  variantRows: Array<{ name: string; stock: number; attrs: Record<string, string> }>
  skuCustomColumns: Array<{ key: string; label: string }>
} | null {
  if (!table || table.length === 0) return null
  const variantRows = table.map((v) => {
    const color = (v.color ?? "").trim()
    const size = (v.size ?? "").trim()
    const attrs: Record<string, string> = {}
    if (v.customData && typeof v.customData === "object" && !Array.isArray(v.customData)) {
      for (const [k, val] of Object.entries(v.customData as Record<string, unknown>)) {
        if (val != null && String(val).trim()) attrs[k] = String(val).trim()
      }
    }
    const stock = Number(v.stock)
    return { name: size ? `${color} / ${size}` : color, stock: Number.isFinite(stock) ? Math.max(0, Math.round(stock)) : 0, attrs }
  })
  return { variantRows, skuCustomColumns: asColumns(customColumns) }
}

/** The rows a choice is judged against: the advanced rows when the product has them, else the table's variants. */
export function rowsForChoice(variants: unknown, table?: ReadonlyArray<TableVariant> | null, customColumns?: unknown): unknown {
  return rawRows(variants).length > 0 ? variants : variantsFromTable(table, customColumns) ?? variants
}

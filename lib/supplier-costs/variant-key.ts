/**
 * ONE identity for a product variant across cost declarations, order lines and observed costs (founder rule 2026-11-19:
 * a variant's cost is never reused for another variant).
 *
 * A variant is the ordered list of its option values (colour, then size — the order checkout writes them). The canonical
 * key is those values, trimmed, spaces collapsed, Unicode-normalised (NFC) and lower-cased, joined by "|":
 *   ProductVariant { color: "Noir", size: "M" }      → "noir|m"
 *   variantRows[].name "Noir / M"                     → "noir|m"
 *   Order.variantLabel "Noir · M" (formatCartVariantLabel) → "noir|m"
 * Nothing is guessed: a label with one value never matches a two-value variant ("noir" ≠ "noir|m"), and two variants of
 * one product that would share a key make that key AMBIGUOUS — it can then neither be declared nor matched.
 * Pure module.
 */
export const VARIANT_KEY_MAX = 200

function norm(s: string): string {
  return s.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase()
}

/** Key from option values in order; empty values are dropped; null when nothing is left. */
export function variantKeyFromValues(values: ReadonlyArray<string | null | undefined>): string | null {
  const parts = values.map((v) => (typeof v === "string" ? norm(v) : "")).filter((v) => v !== "")
  if (parts.length === 0) return null
  if (parts.some((p) => p.includes("|"))) return null // a value containing the separator can not be told apart: refused
  const key = parts.join("|")
  return key.length <= VARIANT_KEY_MAX ? key : null
}

/** Key of an order line from `Order.variantLabel` ("Noir · M"). Null = no variant on the line. */
export function variantKeyFromOrderLabel(label: string | null | undefined): string | null {
  if (typeof label !== "string" || label.trim() === "") return null
  return variantKeyFromValues(label.split("·"))
}

/** Key of an advanced SKU row from its name ("Noir / M"). */
export function variantKeyFromRowName(name: string | null | undefined): string | null {
  if (typeof name !== "string" || name.trim() === "") return null
  return variantKeyFromValues(name.split("/"))
}

export type VariantOption = {
  key: string
  /** Human label as the supplier wrote it (first spelling met). */
  label: string
  origin: "variant_rows" | "variant_table"
}

export type VariantOptions = {
  options: VariantOption[]
  /** Keys shared by two different variants of the product: never declarable, never matched. */
  ambiguousKeys: string[]
}

/**
 * The variants a supplier can declare a cost for: the advanced SKU rows (`Product.variants.variantRows[].name`) and the
 * `ProductVariant` table rows (colour / size). The same key from both sources is the same variant (checkout writes the
 * same label); the same key twice in ONE source is two variants that can not be told apart → ambiguous.
 */
export function listVariantOptions(input: {
  variants: unknown
  tableRows: ReadonlyArray<{ color: string | null; size: string | null }>
}): VariantOptions {
  const bySource = { variant_rows: new Map<string, string[]>(), variant_table: new Map<string, string[]>() }
  const obj = input.variants && typeof input.variants === "object" && !Array.isArray(input.variants) ? (input.variants as Record<string, unknown>) : null
  const rows = Array.isArray(obj?.variantRows) ? (obj!.variantRows as unknown[]) : []
  for (const r of rows) {
    const name = r && typeof r === "object" ? (r as Record<string, unknown>).name : null
    const key = variantKeyFromRowName(typeof name === "string" ? name : null)
    if (key) bySource.variant_rows.set(key, [...(bySource.variant_rows.get(key) ?? []), String(name).trim()])
  }
  for (const t of input.tableRows) {
    const key = variantKeyFromValues([t.color, t.size])
    if (!key) continue
    const label = [t.color, t.size].filter((v) => typeof v === "string" && v.trim()).map((v) => (v as string).trim()).join(" / ")
    bySource.variant_table.set(key, [...(bySource.variant_table.get(key) ?? []), label])
  }
  const ambiguous = new Set<string>()
  for (const m of Object.values(bySource)) for (const [k, labels] of m) if (labels.length > 1) ambiguous.add(k)
  const options: VariantOption[] = []
  const seen = new Set<string>()
  for (const origin of ["variant_rows", "variant_table"] as const) {
    for (const [key, labels] of bySource[origin]) {
      if (ambiguous.has(key) || seen.has(key)) continue
      seen.add(key)
      options.push({ key, label: labels[0]!, origin })
    }
  }
  return { options: options.sort((a, b) => a.label.localeCompare(b.label)), ambiguousKeys: [...ambiguous].sort() }
}

/** The `variantKey` field of a request: absent / empty = the whole product; otherwise a bounded string (checked later
 *  against the product's CURRENT variants — an unknown key is refused, never stored). */
export function parseVariantKeyField(body: unknown): { ok: true; value: string | null } | { ok: false } {
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>).variantKey : undefined
  if (raw == null || raw === "") return { ok: true, value: null }
  if (typeof raw !== "string" || raw.length > VARIANT_KEY_MAX) return { ok: false }
  return { ok: true, value: raw }
}

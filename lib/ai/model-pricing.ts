/**
 * Versioned price table used to ESTIMATE the cost of a model call from the token counts the provider reports.
 *
 * Honesty rules (owner mandate: no invented figures):
 *  - A price listed here was typed by hand from the provider's public price page on `MODEL_PRICING_VERSION`. It is NOT
 *    fetched, NOT contractual and may be out of date: the cost it yields is an ESTIMATE (`costUsdEstimated`).
 *  - A model that is not in the table has NO price: `estimateCostUsd` answers `null` ("unknown"), never a guess and never a
 *    default. Add the model here (or through `AI_MODEL_PRICING_JSON`) once its price has been verified.
 *  - Tokens come from the provider's own `usage` object (see lib/ai/usage-log.ts); when a provider did not return one, the
 *    cost is `null` too.
 *
 * Operator override without a deploy: `AI_MODEL_PRICING_JSON='{"openai/gpt-oss-20b":{"inputPerMTokUsd":0.1,"outputPerMTokUsd":0.5}}'`
 * (entries are validated; invalid ones are ignored and the version label then carries `+env`).
 *
 * Pure module (no I/O) — safe to import anywhere, including tests.
 */

export const MODEL_PRICING_VERSION = "2026-11-13"

export const MODEL_PRICING_NOTE =
  "Tarifs publics saisis à la main (non récupérés automatiquement) — estimation, à vérifier auprès du fournisseur."

export type ModelPrice = {
  /** USD per 1 000 000 input (prompt) tokens. */
  inputPerMTokUsd: number
  /** USD per 1 000 000 output (completion) tokens. */
  outputPerMTokUsd: number
}

/**
 * Only models whose public price is known to the maintainers. Anything else (Groq, Anthropic, Gemini models used by the
 * app) is deliberately absent until verified: its cost is reported as "unknown", not invented.
 */
export const MODEL_PRICES: Readonly<Record<string, ModelPrice>> = {
  "gpt-4o": { inputPerMTokUsd: 2.5, outputPerMTokUsd: 10 },
  "gpt-4o-mini": { inputPerMTokUsd: 0.15, outputPerMTokUsd: 0.6 },
  "text-embedding-3-small": { inputPerMTokUsd: 0.02, outputPerMTokUsd: 0 },
}

function isValidPrice(value: unknown): value is ModelPrice {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return (
    typeof v.inputPerMTokUsd === "number" &&
    Number.isFinite(v.inputPerMTokUsd) &&
    v.inputPerMTokUsd >= 0 &&
    typeof v.outputPerMTokUsd === "number" &&
    Number.isFinite(v.outputPerMTokUsd) &&
    v.outputPerMTokUsd >= 0
  )
}

/** Parses the optional operator override. Never throws; invalid entries are dropped. */
export function parsePricingOverride(raw: string | undefined | null): Record<string, ModelPrice> {
  const text = raw?.trim()
  if (!text) return {}
  try {
    const parsed: unknown = JSON.parse(text)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    const out: Record<string, ModelPrice> = {}
    for (const [model, price] of Object.entries(parsed as Record<string, unknown>)) {
      if (model.trim() && isValidPrice(price)) {
        out[model.trim().toLowerCase()] = {
          inputPerMTokUsd: price.inputPerMTokUsd,
          outputPerMTokUsd: price.outputPerMTokUsd,
        }
      }
    }
    return out
  } catch {
    return {}
  }
}

export type PriceTable = {
  version: string
  prices: Record<string, ModelPrice>
}

/** Built-in table, plus the operator override when present (override wins). */
export function resolvePriceTable(env: Record<string, string | undefined> = process.env): PriceTable {
  const override = parsePricingOverride(env.AI_MODEL_PRICING_JSON)
  const hasOverride = Object.keys(override).length > 0
  return {
    version: hasOverride ? `${MODEL_PRICING_VERSION}+env` : MODEL_PRICING_VERSION,
    prices: { ...MODEL_PRICES, ...override },
  }
}

/**
 * Looks a model id up: exact match first, then the LONGEST listed prefix ("gpt-4o-mini-2024-07-18" -> "gpt-4o-mini",
 * never "gpt-4o"). Unknown model -> `null`.
 */
export function lookupModelPrice(model: string | null | undefined, table: PriceTable): ModelPrice | null {
  const id = model?.trim().toLowerCase()
  if (!id) return null
  const exact = table.prices[id]
  if (exact) return exact
  let best: string | null = null
  for (const key of Object.keys(table.prices)) {
    if (id.startsWith(`${key}-`) && (best === null || key.length > best.length)) best = key
  }
  return best ? (table.prices[best] ?? null) : null
}

export type CostEstimate = {
  /** `null` = unknown (model not priced, or the provider returned no token counts). */
  costUsd: number | null
  pricingVersion: string
}

export function estimateCostUsd(
  args: {
    model: string | null | undefined
    promptTokens: number | null | undefined
    completionTokens: number | null | undefined
  },
  table: PriceTable = resolvePriceTable()
): CostEstimate {
  const price = lookupModelPrice(args.model, table)
  const p = args.promptTokens
  const c = args.completionTokens
  if (
    !price ||
    typeof p !== "number" ||
    !Number.isFinite(p) ||
    p < 0 ||
    typeof c !== "number" ||
    !Number.isFinite(c) ||
    c < 0
  ) {
    return { costUsd: null, pricingVersion: table.version }
  }
  const usd = (p * price.inputPerMTokUsd + c * price.outputPerMTokUsd) / 1_000_000
  return { costUsd: Math.round(usd * 1e8) / 1e8, pricingVersion: table.version }
}

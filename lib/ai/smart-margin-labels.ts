import type { MarketDataOrigin } from "@/lib/ai/smart-margin-types"

/**
 * Client-safe wording of the note shown under the Smart Margin panel title (pure, no I/O).
 *
 * It says what the margin formulas were fed with — never more. `origin` is `undefined` for an analysis cached before
 * `market_data` existed: its origin is UNKNOWN, so the note does not guess "demonstration" nor "category and price".
 */
export function marketDataNote(origin: MarketDataOrigin | undefined): string {
  if (origin === "fixture") return "Données de marché : exemple de démonstration, non mesurées."
  if (origin === "heuristic") return "Données de marché : estimation par règle (catégorie et prix), non mesurée."
  return "Données de marché : non mesurées."
}

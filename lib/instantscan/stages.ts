/**
 * InstantScan stage identifiers and honest descriptions — pure, client-safe (no I/O, no env, no Prisma).
 *
 * A "stage" says which step PRODUCED the answer. It does not say how good the answer is: there is no measured accuracy
 * behind any stage (see docs/AI-HONESTY-AND-MEASUREMENT.md).
 *
 *   catalog_match  a vision LLM (gpt-4o-mini by default) wrote text cues from the photo, then those cues were compared as
 *                  TEXT with a hand-written list of models (hashed lexical vectors — see lib/ai/openai-embeddings.ts). It is
 *                  NOT CLIP and no image embedding is computed. It used to be called "embed" and presented as "CLIP".
 *   mini           the full vision step was answered by a *mini* model (gpt-4o-mini family) — in practice the silent
 *                  fallback after the primary model failed. `provenance.modelUsed` / `provenance.fallbackUsed` say so.
 *   gpt4o          the full vision step answered by the primary OpenAI vision model (`PRODUCT_VISION_V2_MODEL`, gpt-4o by
 *                  default; the exact id is in `provenance.modelUsed`).
 *   groq           legacy single-call path on the Groq vision model (ENABLE_AI_VISION_V2 off).
 */
export const INSTANTSCAN_STAGES = ["catalog_match", "mini", "gpt4o", "groq"] as const

export type InstantScanStage = (typeof INSTANTSCAN_STAGES)[number]

/** How an analysis was produced. `none` = no model ran (soft fallback: the supplier fills the form by hand). */
export type InstantScanMethod = "catalog_lexical_match" | "vision_llm" | "vision_llm_legacy" | "none"

export type InstantScanProvenance = {
  method: InstantScanMethod
  /** Model that really answered the vision step (`null` when none ran). */
  modelUsed: string | null
  /** True when the answer comes from the fallback model, not the one that was asked for. */
  fallbackUsed: boolean
  /**
   * Where `confidence` comes from. `model_self_reported` = a number the model wrote about itself (capped by a few rules),
   * NOT a calibrated probability. `none` = no confidence is given because none was measured.
   */
  confidenceSource: "model_self_reported" | "none"
  /** Raw lexical similarity of the catalog match (shared characters/words), NOT a probability. Only for catalog_match. */
  matchScore?: number
  /** Where `suggestedPrice` comes from. `editorial_list` = a hand-typed indicative price, not market data. */
  priceSource: "model_estimate" | "editorial_list" | "none"
}

export const INSTANTSCAN_STAGE_LABELS_FR: Record<InstantScanStage, string> = {
  catalog_match: "Rapprochement catalogue (texte — pas de CLIP)",
  mini: "Modèle de vision mini (repli)",
  gpt4o: "Modèle de vision principal",
  groq: "Modèle de vision Groq (ancien chemin)",
}

/** Stage names that existed before the honesty fix ("embed" was the so-called CLIP step). */
const LEGACY_STAGE_ALIASES: Record<string, InstantScanStage> = { embed: "catalog_match" }

export function normalizeInstantScanStage(raw: unknown): InstantScanStage | null {
  if (typeof raw !== "string") return null
  if ((INSTANTSCAN_STAGES as readonly string[]).includes(raw)) return raw as InstantScanStage
  return LEGACY_STAGE_ALIASES[raw] ?? null
}

/** Stage of a full-vision answer, from the model that REALLY answered (never from the model that was asked for). */
export function stageFromVisionModel(modelUsed: string | null | undefined): InstantScanStage {
  return /(^|[-/])mini\b/i.test(modelUsed ?? "") ? "mini" : "gpt4o"
}

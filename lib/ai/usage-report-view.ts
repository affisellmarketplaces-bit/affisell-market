import { MODEL_PRICING_NOTE, MODEL_PRICING_VERSION } from "@/lib/ai/model-pricing"
import { INSTANTSCAN_STAGE_LABELS_FR, normalizeInstantScanStage } from "@/lib/instantscan/stages"
import type { AiUsageGroupSummary, AiUsageReport } from "@/lib/ai/usage-stats"

/**
 * View-model of /admin/instantscan-performance: every cell is a MEASURED value or an explicit "aucune mesure" / "inconnu".
 * Pure (no I/O, no React) so the wording rules are unit-tested: nothing here may turn a missing measurement into a number.
 */

export const NO_MEASURE = "aucune mesure"
export const UNKNOWN = "inconnu"

export function formatMs(ms: number | null): string {
  if (ms === null) return NO_MEASURE
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`
}

export function formatUsd(usd: number | null): string {
  if (usd === null) return UNKNOWN
  if (usd === 0) return "0 $"
  return usd < 0.01 ? `${usd.toFixed(6)} $` : `${usd.toFixed(4)} $`
}

export function formatRate(rate: number | null): string {
  return rate === null ? NO_MEASURE : `${(rate * 100).toFixed(1)} %`
}

export type TierRow = {
  key: string
  label: string
  calls: number
  errors: string
  latencyP50: string
  latencyP95: string
  tokens: string
  /** Total of the cost ESTIMATES of the priced calls, with how many calls could not be priced. */
  cost: string
  avgCostPerCall: string
  models: string
  fallbacks: string
}

export type PipelineRow = {
  key: string
  label: string
  analyses: number
  errors: string
  latencyP50: string
  latencyP95: string
}

export type UsagePageModel = {
  empty: boolean
  emptyMessage: string
  backendLabel: string
  period: string
  pricing: { version: string; note: string }
  tiers: TierRow[]
  pipelines: PipelineRow[]
  costNote: string
}

const TIER_LABELS_FR: Record<string, string> = {
  cues_extraction: "Étape catalogue : lecture des indices par le modèle de vision (mini)",
  vision_full: "Modèle de vision complet",
  vision_legacy: "Ancien chemin de vision (Groq)",
  category_match: "Rapprochement de catégorie",
  unlabelled: "Appel sans contexte (hors InstantScan)",
}

function tierLabel(key: string): string {
  const tier = key.split("/")[1] ?? key
  return TIER_LABELS_FR[tier] ?? tier
}

function stageLabel(key: string): string {
  const stage = key.split("/")[1] ?? key
  if (stage === "error") return "Échec (aucune analyse produite)"
  const normalized = normalizeInstantScanStage(stage)
  return normalized ? INSTANTSCAN_STAGE_LABELS_FR[normalized] : stage
}

function tierRow(g: AiUsageGroupSummary): TierRow {
  const models = Object.entries(g.modelsUsed)
    .sort(([, a], [, b]) => b - a)
    .map(([m, n]) => `${m} ×${n}`)
    .join(", ")
  return {
    key: g.key,
    label: tierLabel(g.key),
    calls: g.calls,
    errors: `${g.failedCalls} / ${g.calls} (${formatRate(g.errorRate)})`,
    latencyP50: formatMs(g.latencyMs.p50),
    latencyP95: formatMs(g.latencyMs.p95),
    tokens:
      g.callsWithTokens === 0
        ? "aucun compteur renvoyé par le fournisseur"
        : `${g.promptTokens} entrée + ${g.completionTokens} sortie (${g.callsWithTokens}/${g.calls} appels)`,
    cost:
      g.callsWithCost === 0
        ? `${UNKNOWN} (${g.costUnknownCalls} appel(s) sans tarif ou sans compteur)`
        : `${formatUsd(g.costUsdEstimated)} sur ${g.callsWithCost}/${g.calls} appels` +
          (g.costUnknownCalls > 0 ? ` — ${g.costUnknownCalls} non chiffré(s)` : ""),
    avgCostPerCall: formatUsd(g.avgCostUsdPerCall),
    models: models || UNKNOWN,
    fallbacks: g.fallbackCalls === 0 ? "aucun" : `${g.fallbackCalls} appel(s) répondu(s) par le modèle de repli`,
  }
}

function pipelineRow(g: AiUsageGroupSummary): PipelineRow {
  return {
    key: g.key,
    label: stageLabel(g.key),
    analyses: g.calls,
    errors: `${g.failedCalls} / ${g.calls} (${formatRate(g.errorRate)})`,
    latencyP50: formatMs(g.latencyMs.p50),
    latencyP95: formatMs(g.latencyMs.p95),
  }
}

export function buildUsagePageModel(
  report: AiUsageReport,
  source: { backend: "redis" | "memory"; degraded: boolean }
): UsagePageModel {
  const backendLabel =
    source.backend === "redis"
      ? "Journal partagé (Redis, 30 jours, 2000 derniers enregistrements)"
      : source.degraded
        ? "Redis injoignable : mémoire de CETTE instance serveur uniquement (volatile, partielle)"
        : "Redis non configuré : mémoire de CETTE instance serveur uniquement (volatile, partielle)"
  return {
    empty: report.totalRecords === 0,
    emptyMessage:
      "Aucune mesure. Aucun appel de modèle n'a été journalisé sur cette source (InstantScan est désactivé par défaut : ENABLE_INSTANTSCAN) — aucun chiffre de précision, de latence ou de coût n'est affiché tant qu'il n'y a rien de mesuré.",
    backendLabel,
    period:
      report.firstAt && report.lastAt
        ? `${report.totalRecords} enregistrement(s), du ${report.firstAt} au ${report.lastAt}`
        : NO_MEASURE,
    pricing: { version: MODEL_PRICING_VERSION, note: MODEL_PRICING_NOTE },
    tiers: report.modelCallsByTier.map(tierRow),
    pipelines: report.pipelineByStage.map(pipelineRow),
    costNote:
      "Le coût est une ESTIMATION : jetons réellement renvoyés par le fournisseur × tarif public saisi à la main (table versionnée). Un modèle sans tarif connu n'est pas chiffré.",
  }
}

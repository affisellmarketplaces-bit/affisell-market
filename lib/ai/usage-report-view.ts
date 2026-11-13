import { MODEL_PRICING_NOTE, MODEL_PRICING_VERSION } from "@/lib/ai/model-pricing"
import { INSTANTSCAN_STAGE_LABELS_FR, normalizeInstantScanStage } from "@/lib/instantscan/stages"
import type { AiUsageGroupSummary, AiUsageReport } from "@/lib/ai/usage-stats"

/**
 * View-model of /admin/instantscan-performance: every cell is a MEASURED value or an explicit "aucune mesure" / "inconnu".
 * Pure (no I/O, no React) so the wording rules are unit-tested: nothing here may turn a missing measurement into a number.
 */

export const NO_MEASURE = "aucune mesure"
export const UNKNOWN = "inconnu"
/** A step that was called but never answered (every request failed): there is no latency OF AN ANSWER to show. */
export const NO_ANSWER = "aucune réponse"

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

function countsLine(counts: Record<string, number>): string {
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([m, n]) => `${m} ×${n}`)
    .join(", ")
}

/** Failures, with WHICH models were asked for and failed, and how long a failure took (a timeout is not a latency). */
function errorsCell(g: AiUsageGroupSummary): string {
  const base = `${g.failedCalls} / ${g.calls} (${formatRate(g.errorRate)})`
  if (g.failedCalls === 0) return base
  const failed = countsLine(g.modelsFailed)
  const took = g.failedLatencyMs.p95 === null ? "" : ` ; durée p95 d'un échec : ${formatMs(g.failedLatencyMs.p95)}`
  return `${base}${failed ? ` — échecs : ${failed}` : ""}${took}`
}

/** Latency OF ANSWERS; "aucune réponse" when every request failed (never a latency invented from failures). */
function answerLatency(g: AiUsageGroupSummary, value: number | null): string {
  if (value !== null) return formatMs(value)
  return g.calls > 0 && g.okCalls === 0 ? NO_ANSWER : NO_MEASURE
}

function tierRow(g: AiUsageGroupSummary): TierRow {
  const models = countsLine(g.modelsUsed)
  const fallbackParts = [
    g.fallbackCalls > 0 ? `${g.fallbackCalls} appel(s) répondu(s) par le modèle de repli` : "",
    g.fallbackFailedCalls > 0 ? `${g.fallbackFailedCalls} tentative(s) de repli en échec` : "",
  ].filter(Boolean)
  return {
    key: g.key,
    label: tierLabel(g.key),
    calls: g.calls,
    errors: errorsCell(g),
    latencyP50: answerLatency(g, g.latencyMs.p50),
    latencyP95: answerLatency(g, g.latencyMs.p95),
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
    models: models || (g.calls > 0 && g.okCalls === 0 ? "aucun (aucune requête n'a abouti)" : UNKNOWN),
    fallbacks: fallbackParts.length === 0 ? "aucun" : fallbackParts.join(" ; "),
  }
}

function pipelineRow(g: AiUsageGroupSummary): PipelineRow {
  return {
    key: g.key,
    label: stageLabel(g.key),
    analyses: g.calls,
    errors: `${g.failedCalls} / ${g.calls} (${formatRate(g.errorRate)})`,
    // the "error" stage has only failures: show how long they took, labelled as such, instead of "no measure"
    latencyP50: pipelineLatency(g, g.latencyMs.p50, g.failedLatencyMs.p50),
    latencyP95: pipelineLatency(g, g.latencyMs.p95, g.failedLatencyMs.p95),
  }
}

function pipelineLatency(g: AiUsageGroupSummary, answered: number | null, failed: number | null): string {
  if (answered !== null) return formatMs(answered)
  if (g.okCalls === 0 && failed !== null) return `${formatMs(failed)} (durée des échecs)`
  return NO_MEASURE
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

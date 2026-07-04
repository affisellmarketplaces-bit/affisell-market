/** Preset A/B winner status — client-safe (no Prisma). */

import {
  evaluatePresetAbWinner,
  type PresetAbVariant,
  type PresetAbWinnerResult,
  type StorefrontPresetAb,
} from "@/lib/storefront-preset-ab-shared"

const MIN_EXPERIMENT_MS = 7 * 24 * 60 * 60 * 1000
const MIN_VIEWS_FOR_WINNER = 20

export function getPresetAbDaysRemaining(presetAb: StorefrontPresetAb): number {
  const ageMs = Date.now() - new Date(presetAb.startedAt).getTime()
  const remainingMs = Math.max(0, MIN_EXPERIMENT_MS - ageMs)
  return Math.ceil(remainingMs / (24 * 60 * 60 * 1000))
}

export function getPresetAbViewsRemaining(presetAb: StorefrontPresetAb): number {
  const total = presetAb.viewsControl + presetAb.viewsChallenger
  return Math.max(0, MIN_VIEWS_FOR_WINNER - total)
}

export function formatPresetAbWinnerVariant(args: {
  variant: PresetAbVariant
  locale: "fr" | "en"
}): string {
  if (args.locale === "en") {
    return args.variant === "challenger" ? "Challenger preset" : "Control preset"
  }
  return args.variant === "challenger" ? "Preset challenger" : "Preset contrôle"
}

export function formatPresetAbWinnerReason(args: {
  reason: PresetAbWinnerResult["reason"]
  locale: "fr" | "en"
}): string {
  const mapEn: Record<PresetAbWinnerResult["reason"], string> = {
    insufficient_views: "Waiting for more storefront views",
    too_early: "Experiment still running (7-day minimum)",
    challenger_wins: "Challenger beat control by 10%+ views",
    control_wins: "Control beat challenger by 10%+ views",
    tie_control: "Tie — control kept as default",
  }
  const mapFr: Record<PresetAbWinnerResult["reason"], string> = {
    insufficient_views: "En attente de plus de vues vitrine",
    too_early: "Expérience en cours (minimum 7 jours)",
    challenger_wins: "Challenger devance le contrôle de 10 %+ de vues",
    control_wins: "Contrôle devance le challenger de 10 %+ de vues",
    tie_control: "Égalité — le contrôle est conservé",
  }
  return args.locale === "en" ? mapEn[args.reason] : mapFr[args.reason]
}

export function formatPresetAbExperimentStatus(args: {
  presetAb: StorefrontPresetAb
  locale: "fr" | "en"
}): string | null {
  if (!args.presetAb.enabled) return null
  const evaluation = evaluatePresetAbWinner(args.presetAb)
  if (evaluation.winner) {
    const winner = formatPresetAbWinnerVariant({ variant: evaluation.winner, locale: args.locale })
    return args.locale === "en"
      ? `Ready to apply — ${winner} is ahead.`
      : `Prêt à appliquer — ${winner} en tête.`
  }
  const days = getPresetAbDaysRemaining(args.presetAb)
  const views = getPresetAbViewsRemaining(args.presetAb)
  if (evaluation.reason === "too_early" && views > 0) {
    return args.locale === "en"
      ? `${days} day(s) left · ${views} more view(s) needed`
      : `${days} jour(s) restant(s) · ${views} vue(s) supplémentaire(s) requise(s)`
  }
  if (evaluation.reason === "too_early") {
    return args.locale === "en" ? `${days} day(s) left in experiment` : `${days} jour(s) restant(s)`
  }
  if (evaluation.reason === "insufficient_views") {
    return args.locale === "en"
      ? `${views} more view(s) needed before a winner can be declared`
      : `${views} vue(s) supplémentaire(s) avant déclaration du gagnant`
  }
  return null
}

export function canApplyPresetAbWinner(presetAb: StorefrontPresetAb): boolean {
  if (!presetAb.enabled || presetAb.winnerAppliedAt) return false
  return evaluatePresetAbWinner(presetAb).winner != null
}

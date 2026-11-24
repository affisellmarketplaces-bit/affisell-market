import "server-only"

import { unstable_cache } from "next/cache"

import { prisma } from "@/lib/prisma"
import { loadPresenceSourceCoverage, loadPresenceTrackingStart } from "@/lib/listing-presence/presence.server"
import { readBlindSpotsMode } from "./blind-spots"
import { readTemporalMode, measurePeriods, type MeasuredPeriod } from "./temporal-opportunities"
import { loadTemporalInputs } from "./temporal-opportunities.server"
import { readRetentionMode, RETENTION_ACTION } from "./retention-advisor"
import { readPlanMode, PLAN_ACTION } from "./observation-plan"
import { readContextualMode, CH_SNAPSHOT_ACTION, CH_MODEL_VERSION, parseSnapshot } from "./contextual-horizon"
import { buildActivationReadiness, type ActivationReadinessReport, type EngineId, type ReadinessFacts } from "./activation-readiness"

const countAction = (action: string) => prisma.auditLog.count({ where: { action } }).catch(() => 0)

/**
 * ADMIN, READ-ONLY: aggregated facts for the activation readiness report. Reads the presence history (only when the
 * migration is applied — otherwise nothing heavy is read), the engines' own measured periods, marker COUNTS and the
 * five flags. Writes nothing, changes no flag. Every failure = a report saying « unreadable », never a fake volume.
 */
export async function collectReadinessFacts(now = new Date()): Promise<ReadinessFacts> {
  const modes: Record<EngineId, string> = {
    blind_spots: readBlindSpotsMode(),
    temporal: readTemporalMode(),
    retention: readRetentionMode(),
    observation_plan: readPlanMode(),
    contextual_horizon: readContextualMode(),
  }
  const trackingStartedAt = await loadPresenceTrackingStart()
  const [retention, plan, contextualSnapshots] = await Promise.all([countAction(RETENTION_ACTION), countAction(PLAN_ACTION), countAction(CH_SNAPSHOT_ACTION)])
  const markers = { retention, plan, contextualSnapshots }
  if (!trackingStartedAt) {
    return { now, migrationApplied: false, trackingStartedAt: null, presenceTruncated: false, presenceEvents90d: null, unattributedShare: null, periods: [], unjudgedPeriods: 0, markers, modes }
  }
  const [inputs, coverage] = await Promise.all([loadTemporalInputs(now), loadPresenceSourceCoverage(90, now)])
  const periods: MeasuredPeriod[] = []
  let unjudged = 0
  for (const l of inputs.listings) {
    const m = measurePeriods(l, now)
    periods.push(...m.periods)
    unjudged += m.unjudged
  }
  return {
    now,
    migrationApplied: true,
    trackingStartedAt,
    presenceTruncated: inputs.truncated,
    presenceEvents90d: coverage?.total ?? null,
    unattributedShare: coverage?.unattributedShare ?? null,
    periods,
    unjudgedPeriods: unjudged,
    markers,
    modes,
  }
}

async function computeReport(): Promise<ActivationReadinessReport> {
  const now = new Date()
  const facts = await collectReadinessFacts(now)
  // Validation = the engine's OWN verdict on real data, read only when that engine is already observing.
  const validated: Partial<Record<EngineId, boolean>> = {}
  // Read from the latest RECORDED daily snapshot (never recomputed here: recomputing would write a snapshot).
  const last = await prisma.auditLog.findFirst({ where: { action: CH_SNAPSHOT_ACTION }, orderBy: { createdAt: "desc" }, select: { payload: true } }).catch(() => null)
  const snap = last ? parseSnapshot(last.payload) : null
  validated.contextual_horizon = Boolean(snap && snap.version === CH_MODEL_VERSION && snap.verdict === "meilleur")
  return buildActivationReadiness(facts, validated)
}

const cached = unstable_cache(async () => JSON.stringify(await computeReport()), ["copilot-activation-readiness-v1"], { revalidate: 6 * 3600 })

/** Founder report, cached 6 h. null = unreadable (never a guessed report). */
export async function loadActivationReadiness(): Promise<ActivationReadinessReport | null> {
  try {
    return JSON.parse(await cached()) as ActivationReadinessReport
  } catch (error) {
    console.error("[activation-readiness] unreadable", error instanceof Error ? error.message : "unknown")
    return null
  }
}

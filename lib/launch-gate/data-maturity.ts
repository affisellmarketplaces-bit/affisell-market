/**
 * Data maturity — not « can the engine start » but « are its data reliable enough to produce useful intelligence ».
 * PURE. Reads only what the existing reports produce (`report:presence-readiness`, the activation-readiness report);
 * never a score: eight dimensions side by side, each `satisfaisant` / `insuffisant` / `inconnu`, with its evidence.
 * A dimension with no data is `inconnu`, never 0 and never « ok ». Verdict per engine by RULE:
 *  - `non_demarrable`        technically blocked (level < 2, or no history for an engine that needs it);
 *  - `demarrable_donnees_insuffisantes`  can run, but at least one dimension is insufficient (collected ≠ sufficient);
 *  - `maturite_inconnue`     can run, nothing insufficient, but a dimension is unknown;
 *  - `donnees_utiles`        every dimension satisfied — still NOT an activation (a separate decision).
 */
import type { CheckStatus, PresenceReadinessReport } from "../listing-presence/integrity"
import type { ActivationReadinessReport, EngineId } from "../reseller-copilot/activation-readiness"
import { BLIND_SPOT_WINDOW_DAYS } from "../reseller-copilot/blind-spots"
import { CH_CAP_DAYS } from "../reseller-copilot/contextual-horizon"
import { TEMPORAL_MIN_OBSERVATION_DAYS } from "../reseller-copilot/temporal-opportunities"

export type DimensionId = "fraicheur" | "completude" | "provenance" | "integrite" | "couverture_temporelle" | "diversite" | "suffisance" | "stabilite"
export type DimensionValue = "satisfaisant" | "insuffisant" | "inconnu"
export type Dimension = { id: DimensionId; value: DimensionValue; evidence: string }
export type MaturityVerdict = "non_demarrable" | "demarrable_donnees_insuffisantes" | "maturite_inconnue" | "donnees_utiles"
export type EngineMaturity = { engine: EngineId; verdict: MaturityVerdict; dimensions: Dimension[] }

/** History needed by each engine before its judgement can exist (the engines' own constants). */
export const REQUIRED_HISTORY_DAYS: Record<EngineId, number> = {
  blind_spots: BLIND_SPOT_WINDOW_DAYS,
  temporal: TEMPORAL_MIN_OBSERVATION_DAYS,
  observation_plan: TEMPORAL_MIN_OBSERVATION_DAYS,
  retention: TEMPORAL_MIN_OBSERVATION_DAYS,
  contextual_horizon: 2 * CH_CAP_DAYS, // two halves, each followed CH_CAP_DAYS (derived)
}
/** Freshness: the newest presence event must be younger than this, while listings change every day. */
export const MAX_EVENT_AGE_HOURS = 48
/** Completeness: share of periods that can not be judged (unknown edges). */
export const MAX_UNJUDGED_SHARE = 0.2
/** Stability: between two readings the unjudged share may move by this much, and volumes may not go backwards. */
export const MAX_UNJUDGED_DRIFT = 0.1

export type MaturityInput = {
  now: Date
  readiness: PresenceReadinessReport | null
  activation: ActivationReadinessReport | null
  /** The newest `effectiveAt` of the presence table (null = unknown). */
  lastEventAt: Date | null
  /** A previous activation report, to judge stability (null = unknown). */
  previous: ActivationReadinessReport | null
}

const dim = (id: DimensionId, value: DimensionValue, evidence: string): Dimension => ({ id, value, evidence })

export function engineMaturity(engine: EngineId, i: MaturityInput): EngineMaturity {
  const a = i.activation
  const e = a?.engines.find((x) => x.id === engine) ?? null
  const d = a?.data ?? null
  const dims: Dimension[] = []

  dims.push(
    i.lastEventAt
      ? (() => {
          const h = (i.now.getTime() - i.lastEventAt.getTime()) / 3_600_000
          return dim("fraicheur", h <= MAX_EVENT_AGE_HOURS ? "satisfaisant" : "insuffisant", `dernier événement il y a ${Math.round(h)} h (seuil ${MAX_EVENT_AGE_HOURS} h)`)
        })()
      : dim("fraicheur", "inconnu", "date du dernier événement non lue"),
  )

  const v = i.readiness?.volumes ?? null
  const totalPeriods = v ? v.completePeriods + v.ongoingPeriods + v.unjudgedPeriods : 0
  dims.push(
    !v || totalPeriods === 0
      ? dim("completude", "inconnu", v ? "aucune période" : "volumes non calculés")
      : dim(
          "completude",
          v.unjudgedPeriods / totalPeriods <= MAX_UNJUDGED_SHARE ? "satisfaisant" : "insuffisant",
          `${v.unjudgedPeriods} / ${totalPeriods} périodes non jugeables (seuil ${MAX_UNJUDGED_SHARE * 100} %)`,
        ),
  )

  dims.push(
    d?.unattributedShare == null
      ? dim("provenance", "inconnu", "part « unattributed » non mesurée")
      : dim("provenance", d.unattributedShare === 0 ? "satisfaisant" : "insuffisant", `part « unattributed » ${Math.round(d.unattributedShare * 1000) / 10} % (0 attendu : tout écrivain applicatif est attribué)`),
  )

  const g: CheckStatus | null = i.readiness?.global ?? null
  const critical = i.readiness?.checks.filter((c) => c.critical && c.section !== "D_volumes" && c.status !== "PASS") ?? []
  dims.push(
    g == null
      ? dim("integrite", "inconnu", "rapport de préparation non lu")
      : critical.length === 0
        ? dim("integrite", "satisfaisant", "aucun contrôle critique non conforme")
        : dim("integrite", critical.some((c) => c.status === "UNKNOWN") && !critical.some((c) => c.status === "BLOCKED") ? "inconnu" : "insuffisant", `${critical.length} contrôle(s) critique(s) : ${critical.map((c) => `${c.id}=${c.status}`).join(", ")}`),
  )

  const need = REQUIRED_HISTORY_DAYS[engine]
  dims.push(
    d?.historyDays == null
      ? dim("couverture_temporelle", "inconnu", `historique non mesuré (besoin ${need} j)`)
      : dim("couverture_temporelle", d.historyDays >= need ? "satisfaisant" : "insuffisant", `${Math.floor(d.historyDays)} j d'historique / ${need} j requis`),
  )

  dims.push(
    !e || !d
      ? dim("diversite", "inconnu", "revendeurs non mesurés")
      : dim("diversite", (e.resellersMissing ?? 1) <= 0 ? "satisfaisant" : "insuffisant", `${d.resellers} revendeurs ; ${e.resellersRequired} requis par le moteur`),
  )

  dims.push(
    !e
      ? dim("suffisance", "inconnu", "écarts du moteur non mesurés")
      : e.gaps.some((x) => x.available == null)
        ? dim("suffisance", "inconnu", "au moins un seuil non mesurable")
        : dim("suffisance", e.gaps.every((x) => (x.missing ?? 0) <= 0) ? "satisfaisant" : "insuffisant", e.gaps.map((x) => `${x.metric} ${x.available}/${x.required}`).join(" · ") || "aucun seuil"),
  )

  const p = i.previous?.data ?? null
  dims.push(
    !p || !d
      ? dim("stabilite", "inconnu", "une seule lecture : stabilité non mesurable")
      : (() => {
          const share = (x: typeof d) => (x.periods > 0 ? x.unjudgedPeriods / x.periods : 0)
          const backwards = d.periods < p.periods || d.firstSales < p.firstSales
          const drift = Math.abs(share(d) - share(p))
          return dim("stabilite", !backwards && drift <= MAX_UNJUDGED_DRIFT ? "satisfaisant" : "insuffisant", backwards ? "volumes en recul entre deux lectures (perte de données ?)" : `écart de part non jugeable ${Math.round(drift * 1000) / 10} pts`)
        })(),
  )

  let verdict: MaturityVerdict
  const startable = e != null && e.level >= 2 && !(e.state === "bloque")
  if (!startable) verdict = "non_demarrable"
  else if (dims.some((x) => x.value === "insuffisant")) verdict = "demarrable_donnees_insuffisantes"
  else if (dims.some((x) => x.value === "inconnu")) verdict = "maturite_inconnue"
  else verdict = "donnees_utiles"
  return { engine, verdict, dimensions: dims }
}

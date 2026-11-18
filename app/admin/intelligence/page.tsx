import Link from "next/link"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { DecisionForm, MeasureButton } from "@/components/admin/intelligence/decision-controls"
import { loadIntelligenceCockpit } from "@/lib/strategic-intelligence/collect.server"
import { GRADE_LABELS, RELIABILITY_MIN_ORDERS, type ComponentVerdict, type RateComponent } from "@/lib/strategic-intelligence/supplier-reliability"
import { familyLearning, LEARN_MIN_ACTED, type LearningState } from "@/lib/strategic-intelligence/learned-priority"
import { POTENTIAL_LABELS, type PotentialClass, type SimulationSummary } from "@/lib/strategic-intelligence/product-economics"
import { DEMAND_ADJUSTMENT_CAVEAT } from "@/lib/strategic-intelligence/demand-adjusted-simulation"
import { SIMULATION_CAVEAT } from "@/lib/strategic-intelligence/lever-simulation"
import {
  DECISION_LABELS,
  LEARNING_MIN_MEASURED,
  METRIC_LABELS,
  metricForSignal,
  signalFamily,
  type DecisionKind,
  type FamilyRecord,
  type JournalMetric,
} from "@/lib/strategic-intelligence/journal"
import { loadJournal, type JournalEntry } from "@/lib/strategic-intelligence/journal.server"
import { NEW_SIGNAL_WINDOW_MS } from "@/lib/strategic-intelligence/scheduled"
import { loadSignalHistory, type SignalHistory } from "@/lib/strategic-intelligence/scheduled.server"
import {
  DOMAIN_LABELS,
  INTELLIGENCE_DOMAINS,
  type SignalKind,
  type SignalPriority,
  type StrategicSignal,
} from "@/lib/strategic-intelligence/types"

export const dynamic = "force-dynamic"

const LEARNING_STATE_LABELS: Record<LearningState["state"], string> = {
  insufficient: "données insuffisantes",
  keep: "priorité inchangée",
  promote: "priorité relevée d’un cran",
  demote: "priorité abaissée d’un cran",
}

const VERDICT_LABELS: Record<ComponentVerdict, string> = {
  better: "meilleur que le reste",
  comparable: "comparable",
  worse: "moins bon que le reste",
  insufficient: "données insuffisantes",
}

function rateCell(c: RateComponent): string {
  const p = (x: number) => `${(x * 100).toFixed(1).replace(".", ",")} %`
  if (c.verdict === "insufficient") return `données insuffisantes (${c.orders} commandes)`
  return `${p(c.rate!)} [${p(c.low!)} – ${p(c.high!)}] sur ${c.orders} — ${VERDICT_LABELS[c.verdict]} (reste : ${p(c.marketplaceRate)})`
}

const PRIORITY: Record<SignalPriority, { label: string; cls: string }> = {
  critical: { label: "Critique", cls: "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100" },
  important: { label: "Importante", cls: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100" },
  study: { label: "À étudier", cls: "border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100" },
}
const KIND: Record<SignalKind, string> = { fact: "Fait", estimate: "Estimation", hypothesis: "Hypothèse", recommendation: "Recommandation" }
const CONF: Record<string, string> = { high: "élevée", medium: "moyenne", low: "faible" }
const STATUS: Record<string, { label: string; cls: string }> = {
  connected: { label: "Connectée", cls: "text-emerald-700" },
  configured: { label: "Identifiants présents, non vérifiée", cls: "text-amber-700" },
  not_connected: { label: "Non connectée", cls: "text-zinc-500" },
}

const VERDICT: Record<string, string> = { improved: "Amélioration", worsened: "Dégradation", inconclusive: "Non concluant" }
const day = (iso: string) => iso.slice(0, 10)

function DecisionBadge({ e }: { e: JournalEntry }) {
  return (
    <p className="mt-2 rounded-md bg-black/5 px-2 py-1 text-xs dark:bg-white/10">
      Décision du {day(e.createdAt)} : <span className="font-medium">{DECISION_LABELS[e.decision as DecisionKind] ?? e.decision}</span> — {e.rationale}
      {e.outcome
        ? ` · Résultat : ${VERDICT[e.outcome.verdict] ?? e.outcome.verdict}`
        : e.dueAt
          ? ` · Mesure prévue le ${day(e.dueAt)}`
          : " · Sans mesure automatique"}
    </p>
  )
}

function HistoryLine({ h, generatedAt }: { h: SignalHistory; generatedAt: string }) {
  const isNew = new Date(generatedAt).getTime() - new Date(h.firstSeenAt).getTime() < NEW_SIGNAL_WINDOW_MS
  return (
    <span className="ml-2 rounded bg-black/10 px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal dark:bg-white/15">
      {isNew ? "Nouveau" : `Signalé depuis le ${day(h.firstSeenAt)} · ${h.timesSeen} relevé(s)`}
    </span>
  )
}

function TrackRecord({ r }: { r: FamilyRecord }) {
  return (
    <p className="mt-1 text-[11px] opacity-80">
      Historique de ce type de signal :{" "}
      {r.measured < LEARNING_MIN_MEASURED
        ? `${r.measured} résultat(s) mesuré(s) — trop peu pour conclure.`
        : `après action, ${r.actedImproved} amélioration(s) sur ${r.actedMeasured} ; sans action, ${r.notActedImproved} sur ${r.notActedMeasured} (observation, pas une preuve de causalité).`}
    </p>
  )
}

function SignalCard({
  s,
  decision,
  journalAvailable,
  history,
  generatedAt,
  track,
}: {
  s: StrategicSignal
  decision?: JournalEntry
  journalAvailable: boolean
  history?: SignalHistory
  generatedAt: string
  track?: FamilyRecord
}) {
  const plan = metricForSignal(s.id)
  return (
    <li className={`rounded-xl border px-4 py-3 ${PRIORITY[s.priority].cls}`}>
      <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide opacity-80">
        <span>{PRIORITY[s.priority].label}</span>·<span>{DOMAIN_LABELS[s.domain]}</span>·<span>{KIND[s.kind]}</span>
        {history ? <HistoryLine h={history} generatedAt={generatedAt} /> : null}
      </div>
      <div className="mt-1 font-semibold">{s.title}</div>
      <dl className="mt-1 grid gap-x-4 text-xs sm:grid-cols-2">
        {s.evidence.map((e) => (
          <div key={e.label} className="flex justify-between gap-2">
            <dt className="opacity-75">{e.label}</dt>
            <dd className="tabular-nums">{e.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-sm">
        <span className="font-medium">Action recommandée : </span>
        {s.recommendedAction}
        {s.link ? (
          <>
            {" "}
            <Link href={s.link} className="underline">
              Ouvrir →
            </Link>
          </>
        ) : null}
      </p>
      <p className="mt-1 text-[11px] opacity-70">
        Source : {s.source.id} — {s.source.query}. Observé le {s.observedAt.slice(0, 16).replace("T", " ")} UTC
        {s.window ? ` sur ${s.window.from.slice(0, 10)} → ${s.window.to.slice(0, 10)}` : ""}. Confiance {CONF[s.confidence]} : {s.confidenceReason}
      </p>
      {track ? <TrackRecord r={track} /> : null}
      {decision ? <DecisionBadge e={decision} /> : null}
      {journalAvailable && !(decision && decision.status === "open") ? (
        <DecisionForm signalId={s.id} measurable={Boolean(plan)} defaultDays={plan?.defaultDays ?? null} />
      ) : null}
    </li>
  )
}

/**
 * AFFISELL INTELLIGENCE — founder cockpit, step 1. Reads Affisell's own data only (no external service is called), shows
 * every source with its real connection status, and turns what it observes into prioritised signals with their
 * provenance. Admin only (the /admin layout checks the ADMIN role; checked again here).
 */
export default async function AdminIntelligencePage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login/admin?callbackUrl=/admin/intelligence")
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/")

  const [cockpit, journal] = await Promise.all([loadIntelligenceCockpit(), loadJournal()])
  const reliability = cockpit.reliability ?? { ok: false as const, error: "lecture_impossible" as const }
  const history = await loadSignalHistory(cockpit.signals.map((s) => s.id))
  const now = new Date().toISOString()
  const groups: SignalPriority[] = ["critical", "important", "study"]

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Affisell Intelligence</h1>
        <p className="max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
          Poste de pilotage. Calculé chaque jour par une tâche planifiée (journal des signaux, mesure des décisions échues, un seul récapitulatif quand il y a du nouveau) ; cette page le recalcule à l’affichage sans rien écrire. Les signaux viennent uniquement des sources marquées « connectée » ci-dessous ; un
          domaine sans source n’est pas surveillé et le dit. Chaque signal indique s’il s’agit d’un fait, d’une estimation,
          d’une hypothèse ou d’une recommandation. Généré le {cockpit.generatedAt.slice(0, 16).replace("T", " ")} UTC.
        </p>
      </header>

      {(() => {
        const list = cockpit.signals.filter((s) => s.id.startsWith("synthesis:"))
        if (list.length === 0) return null
        return (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              À décider par fournisseur ou produit <span className="text-sm font-normal text-zinc-500">({list.length})</span>
            </h2>
            <p className="text-sm text-zinc-500">
              Plusieurs détecteurs indépendants visent la même entité. Chaque carte reprend leurs titres ; le détail et la preuve de chacun restent dans les listes ci-dessous.
            </p>
            <ul className="space-y-2">
              {list.map((s) => (
                <SignalCard
                  key={s.id}
                  s={s}
                  decision={journal.latestBySignal[s.id]}
                  journalAvailable={journal.available}
                  history={history[s.id]}
                  generatedAt={cockpit.generatedAt}
                  track={journal.byFamily[signalFamily(s.id)]}
                />
              ))}
            </ul>
          </section>
        )
      })()}

      {groups.map((g) => {
        const list = cockpit.signals.filter((s) => s.priority === g && !s.id.startsWith("synthesis:"))
        return (
          <section key={g} className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {PRIORITY[g].label} <span className="text-sm font-normal text-zinc-500">({list.length})</span>
            </h2>
            {list.length === 0 ? (
              <p className="text-sm text-zinc-500">Rien dans cette catégorie.</p>
            ) : (
              <ul className="space-y-2">
                {list.map((s) => (
                  <SignalCard
                    key={s.id}
                    s={s}
                    decision={journal.latestBySignal[s.id]}
                    journalAvailable={journal.available}
                    history={history[s.id]}
                    generatedAt={cockpit.generatedAt}
                    track={journal.byFamily[signalFamily(s.id)]}
                  />
                ))}
              </ul>
            )}
          </section>
        )
      })}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Journal des décisions et résultats</h2>
        {!journal.available ? (
          <p className="text-sm text-amber-700">Journal indisponible : la migration 20261117150000_intelligence_decision_journal n’est pas appliquée.</p>
        ) : journal.entries.length === 0 ? (
          <p className="text-sm text-zinc-500">Aucune décision consignée pour l’instant.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {journal.entries.map((e) => (
              <li key={e.id} className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                <span className="text-xs text-zinc-500">{day(e.createdAt)}</span>{" "}
                <span className="font-medium">{DECISION_LABELS[e.decision as DecisionKind] ?? e.decision}</span> — {e.title}
                <div className="text-xs text-zinc-600 dark:text-zinc-400">{e.rationale}</div>
                {e.metric ? (
                  <div className="text-xs">
                    {METRIC_LABELS[e.metric as JournalMetric] ?? e.metric} : avant {e.baselineValue}
                    {e.outcome ? (
                      <>
                        {" "}→ après {e.outcome.observedValue} · <span className="font-medium">{VERDICT[e.outcome.verdict] ?? e.outcome.verdict}</span> ({e.outcome.method})
                      </>
                    ) : e.dueAt && e.dueAt <= now ? (
                      <>
                        {" "}· à échéance <MeasureButton decisionId={e.id} />
                      </>
                    ) : (
                      ` · mesure le ${e.dueAt ? day(e.dueAt) : "—"}`
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-zinc-500">Sans indicateur mesurable automatiquement.</div>
                )}
              </li>
            ))}
          </ul>
        )}
        {journal.learning.length > 0 ? (
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Ce que les résultats mesurés montrent</h3>
            <p className="text-xs text-zinc-500">
              Évolutions observées après la décision, pas une preuve de causalité (pas de groupe témoin). « Agi » = agir ou expérimenter ; « non agi » = surveiller ou écarter.
            </p>
            <ul className="text-xs">
              {journal.learning.map((c) => (
                <li key={`${c.decisions}-${c.domain}`}>
                  {DOMAIN_LABELS[c.domain as keyof typeof DOMAIN_LABELS] ?? c.domain} · {c.decisions === "acted" ? "agi" : "non agi"} :{" "}
                  {c.measured < LEARNING_MIN_MEASURED
                    ? `${c.measured} résultat(s) — trop peu pour conclure`
                    : `${c.improved} amélioration(s), ${c.worsened} dégradation(s), ${c.inconclusive} non concluant(s) sur ${c.measured}`}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Potentiel commercial réel des produits</h2>
        <p className="text-sm text-zinc-500">
          Marge nette Affisell par commande, hors TVA : encaissé − remboursé − versé au fournisseur et au revendeur − frais Stripe − coût
          AliExpress en achat automatique. « Constaté » = virements réellement faits ; sinon estimé avec les règles du règlement. Frais Stripe toujours
          estimés (2,9 % + 0,25 € du TTC). Commandes payées il y a 21 à 120 jours ; « rentable » / « à perte » seulement quand tout l’intervalle (± 2 erreurs-types) est du
          même côté de zéro. Rien n’est modifié automatiquement.
        </p>
        {!(cockpit.economics ?? null) ? (
          <p className="text-sm text-zinc-500">Non calculé pour cette génération (voir l’état des collecteurs).</p>
        ) : (
          <>
            <p className="text-sm">
              <span className="font-medium">Qualité des données financières :</span> {cockpit.economics!.quality.usable} commande(s) exploitable(s) sur{" "}
              {cockpit.economics!.quality.orders} ; {Math.round(cockpit.economics!.quality.constatedShare * 100)} % aux virements constatés ; frais Stripe estimés sur{" "}
              {Math.round(cockpit.economics!.quality.feeEstimatedShare * 100)} % (le montant réel prélevé par Stripe n’est enregistré nulle part) ; total corrigé (empreinte de corruption connue) sur{" "}
              {cockpit.economics!.quality.totalCorrected}
              {Object.keys(cockpit.economics!.quality.unusable).length > 0
                ? ` ; écartées : ${Object.entries(cockpit.economics!.quality.unusable).map(([k, v]) => `${k} ${v}`).join(", ")}`
                : ""}
              .
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(POTENTIAL_LABELS) as PotentialClass[])
                .filter((c) => c !== "a_suivre")
                .map((c) => {
                  const list = cockpit.economics!.items.filter((p) => p.cls === c).slice(0, 5)
                  return (
                    <li key={c} className="rounded border border-zinc-200 p-2 text-sm dark:border-zinc-800">
                      <div className="font-medium">
                        {POTENTIAL_LABELS[c]} <span className="text-zinc-500">({cockpit.economics!.counts[c] ?? 0})</span>
                      </div>
                      {list.length === 0 ? (
                        <div className="text-xs text-zinc-500">Aucun produit.</div>
                      ) : (
                        <ul className="mt-1 space-y-1 text-xs">
                          {list.map((p) => (
                            <li key={p.productId}>
                              <span className="font-medium">{p.name}</span> — {p.reasons[0]}
                              {p.econ && p.econ.margin !== "donnees_incompletes" ? ` (constaté : ${Math.round(p.econ.constatedShare * 100)} %)` : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  )
                })}
            </ul>
            {cockpit.economics!.items.filter((p) => p.simulation).length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Simulation des leviers (calcul, rien n’est modifié)</h3>
                <p className="text-xs text-zinc-500">{SIMULATION_CAVEAT}</p>
                {cockpit.economics!.items
                  .filter((p) => p.simulation)
                  .slice(0, 8)
                  .map((p) => {
                    const s = p.simulation!
                    const e = (c: number) => `${(c / 100).toFixed(2).replace(".", ",")} €`
                    return (
                      <details key={p.productId} className="rounded border border-zinc-200 p-2 text-sm dark:border-zinc-800">
                        <summary className="cursor-pointer">
                          <span className="font-medium">{p.name}</span> — {POTENTIAL_LABELS[p.cls]} · aujourd’hui : Affisell {e(s.baselineAffisellCents)}, revendeur{" "}
                          {e(s.baselineResellerCents)}, acheteur {e(s.baselineBuyerCents)} par commande
                          {s.best ? ` · meilleure combinaison : ${s.best.label}` : " · aucune combinaison testée ne suffit"}
                        </summary>
                        {s.modelGapCents != null && s.modelGapCents > 50 ? (
                          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                            Le modèle s’écarte de la marge constatée de {e(s.modelGapCents)} par commande : simulation indicative seulement.
                          </p>
                        ) : null}
                        {s.defaulted.length > 0 ? <p className="mt-1 text-xs text-zinc-500">Valeurs par défaut utilisées : {s.defaulted.join(", ")}.</p> : null}
                        <table className="mt-2 w-full text-left text-xs">
                          <thead className="text-zinc-500">
                            <tr>
                              <th className="py-1 pr-3">Levier</th>
                              <th className="py-1 pr-3">Affisell / commande</th>
                              <th className="py-1 pr-3">Revendeur / commande</th>
                              <th className="py-1">Prix acheteur</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...s.scenarios, ...(s.best ? [{ ...s.best, label: `Combinaison : ${s.best.label}` }] : [])].map((r) => (
                              <tr key={r.label} className="border-t border-zinc-200 dark:border-zinc-800">
                                <td className="py-1 pr-3">{r.label}</td>
                                <td className={`py-1 pr-3 ${r.affisellCents < 0 ? "text-red-600" : ""}`}>{e(r.affisellCents)}</td>
                                <td className="py-1 pr-3">{e(r.resellerCents)}</td>
                                <td className="py-1">
                                  {e(r.buyerCents)} ({r.deltaBuyerPct >= 0 ? "+" : ""}
                                  {r.deltaBuyerPct} %)
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {s.demand ? <DemandAdjustedTable demand={s.demand} /> : null}
                      </details>
                    )
                  })}
              </div>
            ) : null}
          </>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Priorités apprises des résultats</h2>
        <p className="text-sm text-zinc-500">
          Une priorité ne bouge que d’un cran, jamais pour un signal critique, et seulement quand les décisions mesurées sur ce type de signal le
          justifient ({LEARN_MIN_ACTED} décisions « agir » mesurées au minimum ; une hausse exige aussi la comparaison avec « sans action »). C’est
          une association observée, pas une preuve de causalité. Chaque changement est tracé par la tâche quotidienne.
        </p>
        {Object.keys(journal.byFamily).length === 0 ? (
          <p className="text-sm text-zinc-500">Données insuffisantes : aucune décision mesurée pour l’instant.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {Object.entries(journal.byFamily).map(([family, record]) => {
              const l = familyLearning(record)
              const moved = (cockpit.priorityChanges ?? []).filter((c) => c.family === family).length
              return (
                <li key={family}>
                  <span className="font-mono text-xs">{family}</span> — {LEARNING_STATE_LABELS[l.state]}
                  {moved > 0 ? ` (${moved} signal(aux) ajusté(s) aujourd’hui)` : ""} : <span className="text-zinc-600 dark:text-zinc-400">{l.reason}</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Fiabilité des fournisseurs — indice interne</h2>
        <p className="text-sm text-zinc-500">
          Interne, jamais montré aux revendeurs ni aux fournisseurs. Trois composantes mesurées sur les données d’Affisell ; un taux n’est jugé
          qu’à partir de {RELIABILITY_MIN_ORDERS} commandes, et « meilleur » / « moins bon » seulement quand tout l’intervalle de confiance est du même côté
          que le reste de la marketplace. Le niveau est une règle sur ces verdicts, pas une note pondérée.
        </p>
        {!reliability.ok ? (
          <p className="text-sm text-zinc-500">
            {reliability.error === "echantillon_tronque" ? "Trop de commandes pour une lecture complète : aucun indice calculé (jamais sur un échantillon tronqué)." : "Lecture impossible pour le moment."}
          </p>
        ) : reliability.suppliers.length === 0 ? (
          <p className="text-sm text-zinc-500">Aucun fournisseur avec des commandes sur la période.</p>
        ) : (
          <div className="overflow-x-auto">
            <p className="text-xs text-zinc-500">
              Commandes payées du {reliability.window.from.slice(0, 10)} au {reliability.window.to.slice(0, 10)} ; délais : 180 jours de livraisons attestées.
            </p>
            <table className="mt-2 w-full text-left text-sm">
              <thead className="text-xs text-zinc-500">
                <tr>
                  <th className="py-1 pr-3">Fournisseur</th>
                  <th className="py-1 pr-3">Niveau</th>
                  <th className="py-1 pr-3">Annulations (non-expédition)</th>
                  <th className="py-1 pr-3">Problèmes de qualité</th>
                  <th className="py-1 pr-3">Délai (9 sur 10)</th>
                  <th className="py-1">Pourquoi</th>
                </tr>
              </thead>
              <tbody>
                {reliability.suppliers.slice(0, 50).map((r) => (
                  <tr key={r.supplierId} className="border-t border-zinc-200 align-top dark:border-zinc-800">
                    <td className="py-1 pr-3">{r.supplierName}</td>
                    <td className="py-1 pr-3 font-medium">{GRADE_LABELS[r.grade]}</td>
                    <td className="py-1 pr-3">{rateCell(r.shipSla)}</td>
                    <td className="py-1 pr-3">{rateCell(r.quality)}</td>
                    <td className="py-1 pr-3">
                      {r.delivery.verdict === "insufficient"
                        ? `données insuffisantes (${r.delivery.deliveries} livraisons)`
                        : `${Math.round(r.delivery.p90Days!)} j sur ${r.delivery.deliveries} livraisons — ${VERDICT_LABELS[r.delivery.verdict]}`}
                    </td>
                    <td className="py-1 text-xs text-zinc-600 dark:text-zinc-400">{r.reasons.join(" · ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Couverture des huit domaines</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {INTELLIGENCE_DOMAINS.map((d) => {
            const st = cockpit.coverage[d]
            return (
              <li key={d} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
                <span className="font-medium">{DOMAIN_LABELS[d]}</span> —{" "}
                {st ? <span className={STATUS[st]!.cls}>{STATUS[st]!.label}</span> : <span className="text-zinc-500">dérivé des autres domaines</span>}
              </li>
            )
          })}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Sources</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Domaine</th>
                <th className="px-3 py-2">État</th>
                <th className="px-3 py-2">Remarque</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {cockpit.sources.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2">{s.label}</td>
                  <td className="px-3 py-2 text-xs">{DOMAIN_LABELS[s.domain]}</td>
                  <td className={`px-3 py-2 text-xs ${STATUS[s.status]!.cls}`}>{STATUS[s.status]!.label}</td>
                  <td className="px-3 py-2 text-xs text-zinc-500">{s.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-500">
          Collecteurs :{" "}
          {cockpit.collectors.map((c) => `${c.id} ${c.ok ? `✓ (${c.signals})` : `✗ ${c.error}`}`).join(" · ")}
        </p>
      </section>
    </div>
  )
}

type DemandView = NonNullable<SimulationSummary["demand"]>

const DEMAND_STATUS_LABELS = { ajuste: "", prix_inchange: "prix acheteur inchangé : volume inchangé", hors_plage: "hors de la plage de prix observée : non ajusté", refuse: "non ajusté" } as const

/** Constant volume vs volume re-estimated from the measured price sensitivity, over the product's last 30 days. */
function DemandAdjustedTable({ demand }: { demand: DemandView }) {
  const e = (c: number) => `${(c / 100).toFixed(0)} €`
  const n = (v: number) => v.toFixed(1).replace(".", ",")
  const num = (v: number) => v.toFixed(2).replace(".", ",").replace("-", "−")
  const day = (iso: string) => new Date(iso).toLocaleDateString("fr-FR")
  const cell = (constant: number, r: { central: number; min: number; max: number } | undefined, fmt: (v: number) => string) =>
    r ? `${fmt(constant)} → ${fmt(r.central)} (${fmt(r.min)} à ${fmt(r.max)})` : fmt(constant)
  const c = demand.choice
  return (
    <div className="mt-3 space-y-1 text-xs">
      <p className="font-medium text-zinc-800 dark:text-zinc-200">
        Sur 30 jours ({demand.orders30} commande(s) payée(s), constaté) : volume constant → volume ajusté à la demande
      </p>
      {c.ok ? (
        <p className="text-zinc-600 dark:text-zinc-400">
          Estimation : élasticité {num(c.elasticity)} (de {num(c.lo)} à {num(c.hi)}, ± 2 erreurs types), {c.scope === "categorie" ? `catégorie « ${c.label} »` : "marketplace"} —{" "}
          {c.n} changements de prix observés ({c.cuts} baisses, {c.raises} hausses, jusqu’à {n(c.maxAbsChangePct)} %) du {day(c.firstAt)} au {day(c.lastAt)}.
          {c.notes.length > 0 ? ` ${c.notes.join(" ; ")}.` : ""}
        </p>
      ) : (
        <p className="text-amber-700 dark:text-amber-400">{c.reason} Seul le volume constant est affiché.</p>
      )}
      <table className="w-full text-left">
        <thead className="text-zinc-500">
          <tr>
            <th className="py-1 pr-3">Scénario</th>
            <th className="py-1 pr-3">Commandes</th>
            <th className="py-1 pr-3">Payé par les acheteurs (TTC)</th>
            <th className="py-1 pr-3">Marge Affisell</th>
            <th className="py-1">Marge revendeur</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-zinc-200 dark:border-zinc-800">
            <td className="py-1 pr-3">Aujourd’hui</td>
            <td className="py-1 pr-3">{n(demand.baseline.orders)}</td>
            <td className="py-1 pr-3">{e(demand.baseline.buyerRevenueCents)}</td>
            <td className="py-1 pr-3">{e(demand.baseline.affisellCents)}</td>
            <td className="py-1">{e(demand.baseline.resellerCents)}</td>
          </tr>
          {demand.scenarios.map((r) => (
            <tr key={r.label} className="border-t border-zinc-200 dark:border-zinc-800">
              <td className="py-1 pr-3">
                {r.label} ({r.priceChangePct >= 0 ? "+" : ""}
                {n(r.priceChangePct)} % acheteur){r.status !== "ajuste" ? <span className="text-zinc-500"> — {DEMAND_STATUS_LABELS[r.status]}</span> : null}
                {r.resellerKeeps90Pct === false ? <span className="text-amber-700 dark:text-amber-400"> — le revendeur perd plus de 10 % sur la période</span> : null}
              </td>
              <td className="py-1 pr-3">{cell(r.constant.orders, r.adjusted?.orders, n)}</td>
              <td className="py-1 pr-3">{cell(r.constant.buyerRevenueCents, r.adjusted?.buyerRevenueCents, e)}</td>
              <td className="py-1 pr-3">{cell(r.constant.affisellCents, r.adjusted?.affisellCents, e)}</td>
              <td className="py-1">{cell(r.constant.resellerCents, r.adjusted?.resellerCents, e)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-zinc-500">{DEMAND_ADJUSTMENT_CAVEAT}</p>
    </div>
  )
}

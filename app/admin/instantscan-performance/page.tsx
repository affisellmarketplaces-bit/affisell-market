import type { Metadata } from "next"

import { buildUsagePageModel } from "@/lib/ai/usage-report-view"
import { readAiUsageRecords } from "@/lib/ai/usage-log"
import { buildUsageReport } from "@/lib/ai/usage-stats"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "InstantScan performance | Affisell Admin",
  robots: { index: false, follow: false },
}

/**
 * Measured values only. Every figure below comes from the usage journal (lib/ai/usage-log.ts): real token counts reported by
 * the providers, a cost ESTIMATED from a versioned price table, and latencies timed around each call. When nothing was
 * recorded the page says "aucune mesure". No target (precision, p95, cost per analysis) is displayed as if it were a result.
 */
export default async function AdminInstantScanPerformancePage() {
  const { records, backend, degraded } = await readAiUsageRecords()
  const model = buildUsagePageModel(buildUsageReport(records), { backend, degraded })

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Affisell InstantScan — mesures</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Appels de modèle réellement effectués : latence, jetons, coût estimé. Rien n&apos;est promis ici : une valeur est
          affichée seulement si elle a été mesurée.
        </p>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Source des mesures</h2>
        <p className="mt-2 text-zinc-700 dark:text-zinc-300" data-testid="usage-backend">
          {model.backendLabel}
        </p>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400" data-testid="usage-period">
          {model.period}
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Tarifs : table version <code>{model.pricing.version}</code>. {model.pricing.note}
        </p>
      </section>

      {model.empty ? (
        <section
          className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
          data-testid="usage-empty"
        >
          {model.emptyMessage}
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Appels de modèle, par étape</h2>
            <p className="mt-1 text-xs text-zinc-500">{model.costNote}</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs" data-testid="usage-tiers">
                <thead className="text-zinc-500">
                  <tr>
                    <th className="py-2 pr-3">Étape</th>
                    <th className="py-2 pr-3">Appels</th>
                    <th className="py-2 pr-3">Échecs</th>
                    <th className="py-2 pr-3">Latence p50</th>
                    <th className="py-2 pr-3">Latence p95</th>
                    <th className="py-2 pr-3">Jetons (fournisseur)</th>
                    <th className="py-2 pr-3">Coût estimé</th>
                    <th className="py-2 pr-3">Coût moyen / appel</th>
                    <th className="py-2 pr-3">Modèles ayant répondu</th>
                    <th className="py-2 pr-3">Repli</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-800 dark:text-zinc-200">
                  {model.tiers.map((row) => (
                    <tr key={row.key} className="border-t border-zinc-100 align-top dark:border-zinc-800">
                      <td className="py-2 pr-3 font-medium">{row.label}</td>
                      <td className="py-2 pr-3">{row.calls}</td>
                      <td className="py-2 pr-3">{row.errors}</td>
                      <td className="py-2 pr-3">{row.latencyP50}</td>
                      <td className="py-2 pr-3">{row.latencyP95}</td>
                      <td className="py-2 pr-3">{row.tokens}</td>
                      <td className="py-2 pr-3">{row.cost}</td>
                      <td className="py-2 pr-3">{row.avgCostPerCall}</td>
                      <td className="py-2 pr-3">{row.models}</td>
                      <td className="py-2 pr-3">{row.fallbacks}</td>
                    </tr>
                  ))}
                  {model.tiers.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-3 text-zinc-500">
                        aucune mesure
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Analyses complètes, par étape finale (temps de bout en bout)
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs" data-testid="usage-pipelines">
                <thead className="text-zinc-500">
                  <tr>
                    <th className="py-2 pr-3">Étape qui a répondu</th>
                    <th className="py-2 pr-3">Analyses</th>
                    <th className="py-2 pr-3">Échecs</th>
                    <th className="py-2 pr-3">Latence p50</th>
                    <th className="py-2 pr-3">Latence p95</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-800 dark:text-zinc-200">
                  {model.pipelines.map((row) => (
                    <tr key={row.key} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="py-2 pr-3 font-medium">{row.label}</td>
                      <td className="py-2 pr-3">{row.analyses}</td>
                      <td className="py-2 pr-3">{row.errors}</td>
                      <td className="py-2 pr-3">{row.latencyP50}</td>
                      <td className="py-2 pr-3">{row.latencyP95}</td>
                    </tr>
                  ))}
                  {model.pipelines.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-3 text-zinc-500">
                        aucune mesure
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <section className="rounded-2xl border border-zinc-200 p-5 text-sm dark:border-zinc-800" data-testid="usage-not-measured">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Ce qui n&apos;est PAS mesuré</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-600 dark:text-zinc-400">
          <li>
            <strong>Précision de reconnaissance</strong> : non mesurée. Aucun jeu de photos réelles étiquetées n&apos;existe ;
            l&apos;objectif « 98,5 % » n&apos;a jamais été vérifié. Méthode pour la mesurer :{" "}
            <code>docs/AI-HONESTY-AND-MEASUREMENT.md</code>.
          </li>
          <li>
            <strong>Latence p95 &lt; 2 s et coût ~0,003 $ par analyse</strong> : anciens objectifs, non mesurés. Seules les
            valeurs des tableaux ci-dessus font foi, et seulement quand elles existent.
          </li>
          <li>
            Les événements PostHog <code>instant_scan_*</code> sont définis dans <code>lib/telemetry.ts</code> mais{" "}
            <strong>jamais émis</strong> (aucun appelant) : leur absence n&apos;indique pas « aucun usage ».
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-zinc-200 p-5 text-sm dark:border-zinc-800">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Feature flags</h2>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          <code>ENABLE_INSTANTSCAN=1</code> — InstantScan : étape « rapprochement catalogue » (un modèle de vision mini écrit
          des indices texte, comparés à une liste écrite à la main — pas de CLIP) puis modèle de vision complet. Rétrocompat :{" "}
          <code>ENABLE_AI_VISION_V2=1</code> + <code>ENABLE_AI_VISION_CASCADE=1</code> quand{" "}
          <code>ENABLE_INSTANTSCAN=0</code>.
        </p>
      </section>
    </main>
  )
}

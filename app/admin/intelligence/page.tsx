import Link from "next/link"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { loadIntelligenceCockpit } from "@/lib/strategic-intelligence/collect.server"
import {
  DOMAIN_LABELS,
  INTELLIGENCE_DOMAINS,
  type SignalKind,
  type SignalPriority,
  type StrategicSignal,
} from "@/lib/strategic-intelligence/types"

export const dynamic = "force-dynamic"

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

function SignalCard({ s }: { s: StrategicSignal }) {
  return (
    <li className={`rounded-xl border px-4 py-3 ${PRIORITY[s.priority].cls}`}>
      <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide opacity-80">
        <span>{PRIORITY[s.priority].label}</span>·<span>{DOMAIN_LABELS[s.domain]}</span>·<span>{KIND[s.kind]}</span>
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

  const cockpit = await loadIntelligenceCockpit()
  const groups: SignalPriority[] = ["critical", "important", "study"]

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Affisell Intelligence</h1>
        <p className="max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
          Poste de pilotage — étape 1. Les signaux viennent uniquement des sources marquées « connectée » ci-dessous ; un
          domaine sans source n’est pas surveillé et le dit. Chaque signal indique s’il s’agit d’un fait, d’une estimation,
          d’une hypothèse ou d’une recommandation. Généré le {cockpit.generatedAt.slice(0, 16).replace("T", " ")} UTC.
        </p>
      </header>

      {groups.map((g) => {
        const list = cockpit.signals.filter((s) => s.priority === g)
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
                  <SignalCard key={s.id} s={s} />
                ))}
              </ul>
            )}
          </section>
        )
      })}

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

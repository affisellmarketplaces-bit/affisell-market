import type { Metadata } from "next"

import { LegalPageShell } from "@/components/legal/legal-page-shell"
import { generateTransparencyLog } from "@/lib/legal/dsa"

export const metadata: Metadata = {
  title: "Rapport de transparence | Affisell",
  description:
    "Rapport de transparence des activés de modération — Règlement (UE) 2022/2065 (DSA), art. 15.",
}

export const dynamic = "force-dynamic"

export default async function LegalTransparencePage() {
  const log = await generateTransparencyLog()

  return (
    <LegalPageShell
      title="Rapport de transparence"
      description="Informations agrégées et anonymisées sur les activités de modération de la plateforme Affisell, conformément à l'article 15 du Règlement (UE) 2022/2065 (DSA)."
      lastUpdated={new Date().toLocaleDateString("fr-FR")}
    >
      <section className="space-y-6">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Période couverte : <strong>{log.period}</strong>
        </p>

        <ul className="space-y-3">
          {log.summaryLines.map((line) => (
            <li
              key={line}
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-relaxed text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-200"
            >
              {line}
            </li>
          ))}
        </ul>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Modérations L121-1", value: log.moderatedL1211 },
            { label: "Retraits contrefaçon", value: log.removedContrefacon },
            { label: "Signalements DSA", value: log.dsaReportsReceived },
            { label: "Mesures DSA prises", value: log.dsaReportsActionTaken },
            { label: "Rappels GPSR", value: log.recallsInitiated },
            { label: "Scans haut risque", value: log.highRiskScans },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-zinc-200 p-4 text-center dark:border-zinc-800"
            >
              <p className="font-mono text-2xl font-bold text-violet-700 dark:text-violet-300">
                {stat.value}
              </p>
              <p className="mt-1 text-xs text-zinc-500">{stat.label}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-zinc-500">
          Données agrégées sans identification des personnes signalées ou des signaleurs. Point de
          contact DSA :{" "}
          <a href="mailto:legal@affisell.com" className="underline">
            legal@affisell.com
          </a>{" "}
          ·{" "}
          <a href="/legal/signalement" className="underline">
            Formulaire de signalement
          </a>
        </p>
      </section>
    </LegalPageShell>
  )
}

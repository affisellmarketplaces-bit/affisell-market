import Link from "next/link"

import { AgentApplyForm, AgentApplyHero } from "@/components/agents/agent-apply-form"

export const metadata = {
  title: "Devenir agent Affisell — Agent Network",
  description:
    "Candidatez au réseau d'agents Affisell : contrôle qualité, conformité, photo-preuve et relais express pour les fournisseurs.",
}

export default function AgentApplyPage() {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <Link
          href="/"
          className="text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          ← Affisell
        </Link>
        <AgentApplyHero locale="fr" />
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
          <AgentApplyForm locale="fr" />
        </div>
        <p className="mt-6 text-center text-xs text-zinc-500">
          Déjà agent actif ?{" "}
          <a href="mailto:agents@affisell.com" className="text-cyan-700 hover:underline dark:text-cyan-400">
            agents@affisell.com
          </a>
        </p>
      </div>
    </main>
  )
}

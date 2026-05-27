import type { Metadata } from "next"
import { requireAffiliateSession } from "@/lib/dashboard-session"
import { Suspense } from "react"

import { AffiliateAgentChat } from "@/components/affiliate/AffiliateAgentChat"

export const dynamic = "force-dynamic"
export const revalidate = 0

export const metadata: Metadata = {
  title: "Agent sourcing — Affisell",
  description:
    "Agent IA pour affiliés : analysez marges et commissions, choisissez les produits à promouvoir sur votre vitrine.",
  robots: { index: false, follow: false },
}

export default async function AffiliateAgentPage() {
  await requireAffiliateSession("/dashboard/affiliate/agent")

  return (
    <main className="min-h-[calc(100dvh-3.75rem)] bg-gradient-to-b from-violet-50/40 via-white to-zinc-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900">
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
        <header className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">
            Affilié · Intelligence produit
          </p>
          <h1 className="mt-2 text-balance text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
            Analysez. Choisissez. Mettez en vitrine.
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-600 dark:text-zinc-300 sm:text-base">
            Votre copilote pour sourcer les SKU qui rapportent — commissions, marges et fit avec votre audience.
          </p>
        </header>
        <Suspense
          fallback={
            <div className="h-[72vh] animate-pulse rounded-[2rem] bg-zinc-200/80 dark:bg-zinc-800/60" />
          }
        >
          <AffiliateAgentChat />
        </Suspense>
      </div>
    </main>
  )
}

import { requireAffiliateSession } from "@/lib/dashboard-session"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { AffiliateAgentChat } from "@/components/affiliate/AffiliateAgentChat"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function generateMetadata() {
  const t = await getTranslations("affiliate.sourcingAgent")
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    robots: { index: false, follow: false },
  }
}

export default async function AffiliateAgentPage() {
  await requireAffiliateSession("/dashboard/affiliate/agent")
  const t = await getTranslations("affiliate.sourcingAgent")

  return (
    <main className="min-h-[calc(100dvh-3.75rem)] bg-gradient-to-b from-violet-50/40 via-white to-zinc-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900">
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
        <header className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">
            {t("pageEyebrow")}
          </p>
          <h1 className="mt-2 text-balance text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
            {t("pageTitle")}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-600 dark:text-zinc-300 sm:text-base">
            {t("pageSubtitle")}
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

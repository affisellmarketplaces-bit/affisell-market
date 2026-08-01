import type { Metadata } from "next"
import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { TrackingVerifier } from "@/components/shipping/TrackingVerifier"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shipping")
  return {
    title: t("verifyPageTitle"),
    description: t("verifyPageSubtitle"),
  }
}

export default async function ShippingVerifyPage() {
  const t = await getTranslations("shipping")

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8 space-y-2 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">
          Affisell Logistics
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {t("verifyPageTitle")}
        </h1>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          {t("verifyPageSubtitle")}
        </p>
      </header>
      <Suspense
        fallback={
          <div className="h-40 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
        }
      >
        <TrackingVerifier />
      </Suspense>
    </main>
  )
}

import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { ArrowLeft, ShieldCheck, Sparkles, Zap } from "lucide-react"

import { DropForgeImportClient } from "@/components/import/reseller-url-import-client"
import { cn } from "@/lib/utils"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("importPage")
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    openGraph: {
      title: t("metaTitle"),
      description: t("metaDescription"),
    },
  }
}

const MARKET_PILLS = ["AliExpress", "1688", "Amazon", "Temu", "SHEIN"] as const

export default async function DropForgePage() {
  const t = await getTranslations("importPage")

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070712] text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(139,92,246,0.45),transparent),radial-gradient(ellipse_60%_40%_at_100%_20%,rgba(236,72,153,0.22),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:48px_48px]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-5xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-violet-200/80 transition hover:text-white"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Affisell
        </Link>

        <section className="mt-8 text-center sm:mt-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-300/90">
            {t("productTag")}
          </p>
          <p
            className="mt-3 bg-gradient-to-br from-white via-violet-100 to-fuchsia-300 bg-clip-text text-5xl font-black tracking-tight text-transparent sm:text-7xl sm:leading-none"
            style={{ fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif" }}
          >
            {t("productName")}
          </p>
          <h1 className="mt-5 text-balance text-xl font-semibold tracking-tight text-violet-50/95 sm:text-2xl">
            {t("title")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-base text-violet-100/85 sm:text-lg">
            {t("subtitle")}
          </p>

          <ul className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {MARKET_PILLS.map((label) => (
              <li
                key={label}
                className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-[11px] font-semibold text-zinc-200"
              >
                {label}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10 sm:mt-12">
          <Suspense
            fallback={
              <div className="h-28 animate-pulse rounded-[1.75rem] border border-white/10 bg-white/5" />
            }
          >
            <DropForgeImportClient />
          </Suspense>
        </section>

        <section className="mx-auto mt-14 grid max-w-3xl gap-3 sm:grid-cols-3">
          {[
            { icon: Zap, title: t("step1Title"), body: t("step1Body") },
            { icon: Sparkles, title: t("step2Title"), body: t("step2Body") },
            { icon: ShieldCheck, title: t("step3Title"), body: t("step3Body") },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className={cn(
                "rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left backdrop-blur-sm"
              )}
            >
              <Icon className="size-5 text-violet-300" aria-hidden />
              <p className="mt-3 text-sm font-bold text-white">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">{body}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  )
}

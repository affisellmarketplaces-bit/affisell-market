import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { ArrowRight, ShoppingBag, Store, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { DEMO_PERSONAS, type DemoPersonaKey } from "@/lib/demo/demo-shared"
import { cn } from "@/lib/utils"

const PERSONA_ICONS: Record<DemoPersonaKey, LucideIcon> = {
  supplier: Store,
  affiliate: Users,
  buyer: ShoppingBag,
}

export async function DemoLabIndex() {
  const t = await getTranslations("demoLab")

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-3xl border border-violet-500/25 bg-gradient-to-br from-zinc-950 via-violet-950 to-zinc-900 px-6 py-12 text-center text-white sm:px-12 sm:py-16">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.25),transparent_55%)]"
          aria-hidden
        />
        <p className="relative text-[10px] font-semibold uppercase tracking-[0.32em] text-violet-300">
          {t("eyebrow")}
        </p>
        <h1 className="relative mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h1>
        <p className="relative mx-auto mt-4 max-w-lg text-sm leading-relaxed text-zinc-400">
          {t("heroSubtitle")}
        </p>
      </section>

      <ul className="grid gap-5 sm:grid-cols-3">
        {DEMO_PERSONAS.map((persona) => {
          const Icon = PERSONA_ICONS[persona]
          return (
            <li key={persona}>
              <Link
                href={`/demo/${persona}`}
                className={cn(
                  "group flex h-full flex-col rounded-2xl border border-zinc-200/90 bg-white p-6 transition",
                  "hover:border-violet-300 hover:shadow-lg hover:shadow-violet-500/10",
                  "dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-violet-700"
                )}
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                <h2 className="mt-5 text-lg font-bold text-zinc-900 dark:text-white">
                  {t(`personas.${persona}.cardTitle`)}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {t(`personas.${persona}.cardBody`)}
                </p>
                <span className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-violet-700 group-hover:gap-2 dark:text-violet-300">
                  {t("startJourney")}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            </li>
          )
        })}
      </ul>

      <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">{t("privacyNote")}</p>
    </div>
  )
}

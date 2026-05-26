import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { ArrowRight, Globe, Shield, Sparkles, Store, Truck, Users } from "lucide-react"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { CompanyNav } from "@/components/company/company-nav"
import { LiveStatsStrip } from "@/components/company/live-stats-strip"
import { buttonVariants } from "@/components/ui/button"
import { AFFILIATE_CATALOG_PATH } from "@/lib/affiliate-routes"
import { AFFISELL_LEGAL } from "@/lib/legal/entity"
import { cn } from "@/lib/utils"

export async function generateMetadata() {
  const t = await getTranslations("companyPages.about")
  return { title: t("metaTitle"), description: t("metaDescription") }
}

const VALUE_ICONS = [Store, Truck, Shield, Globe] as const
const TIMELINE_KEYS = ["2024", "2025a", "2025b", "2026"] as const

export default async function AboutPage() {
  const t = await getTranslations("companyPages.about")

  return (
    <BentoShell>
      <BentoContainer maxWidth="6xl" className="space-y-10 py-12">
        <CompanyNav active="about" />
        <BentoPageHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />

        <LiveStatsStrip />

        <BentoCard className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight">{t("mission.title")}</h2>
          <p className="leading-relaxed text-zinc-600 dark:text-zinc-300">{t("mission.body")}</p>
          <p className="leading-relaxed text-zinc-600 dark:text-zinc-300">{t("mission.body2")}</p>
        </BentoCard>

        <div className="grid gap-4 md:grid-cols-2">
          {VALUE_ICONS.map((Icon, i) => (
            <BentoCard key={i} className="flex gap-4 p-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-300">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <h3 className="font-semibold">{t(`values.${i}.title`)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {t(`values.${i}.body`)}
                </p>
              </div>
            </BentoCard>
          ))}
        </div>

        <BentoCard className="space-y-6">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-violet-500" aria-hidden />
            <h2 className="text-xl font-bold tracking-tight">{t("timeline.title")}</h2>
          </div>
          <ol className="relative space-y-6 border-l border-violet-200 pl-6 dark:border-violet-900">
            {TIMELINE_KEYS.map((key) => (
              <li key={key} className="relative">
                <span className="absolute -left-[1.62rem] top-1.5 size-3 rounded-full bg-violet-500 ring-4 ring-violet-500/20" />
                <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                  {t(`timeline.items.${key}.year`)}
                </p>
                <p className="mt-1 font-medium">{t(`timeline.items.${key}.title`)}</p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {t(`timeline.items.${key}.body`)}
                </p>
              </li>
            ))}
          </ol>
        </BentoCard>

        <BentoCard className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Users className="size-5 text-violet-500" aria-hidden />
              {t("hq.title")}
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{AFFISELL_LEGAL.address}</p>
            <p className="mt-1 text-sm">
              <a
                href={`mailto:${AFFISELL_LEGAL.email}`}
                className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
              >
                {AFFISELL_LEGAL.email}
              </a>
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/creators" className={cn(buttonVariants({ variant: "bentoAccent", size: "bento" }))}>
              {t("cta.creators")}
              <ArrowRight className="ml-1 size-4" aria-hidden />
            </Link>
            <Link
              href={AFFILIATE_CATALOG_PATH}
              className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }))}
            >
              {t("cta.catalog")}
            </Link>
          </div>
        </BentoCard>
      </BentoContainer>
    </BentoShell>
  )
}

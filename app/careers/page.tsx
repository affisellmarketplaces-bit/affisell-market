import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { Briefcase, MapPin, ArrowRight } from "lucide-react"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { CompanyNav } from "@/components/company/company-nav"
import { CAREER_SLUGS } from "@/lib/company/types"
import { readAffisellLegalEntity } from "@/lib/legal/company-env"
import { cn } from "@/lib/utils"

export async function generateMetadata() {
  const t = await getTranslations("companyPages.careers")
  return { title: t("metaTitle"), description: t("metaDescription") }
}

export default async function CareersPage() {
  const t = await getTranslations("companyPages.careers")
  const legal = readAffisellLegalEntity()

  return (
    <BentoShell>
      <BentoContainer maxWidth="5xl" className="space-y-10 py-12">
        <CompanyNav active="careers" />
        <BentoPageHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />

        <BentoCard className="space-y-3">
          <h2 className="text-lg font-bold">{t("culture.title")}</h2>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t("culture.body")}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {(["remote", "impact", "stack", "equity"] as const).map((key) => (
              <li key={key} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-violet-500" />
                {t(`culture.perks.${key}`)}
              </li>
            ))}
          </ul>
        </BentoCard>

        <div className="space-y-4">
          <h2 className="text-lg font-bold">{t("openRoles")}</h2>
          {CAREER_SLUGS.map((slug) => (
            <BentoCard key={slug} className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Briefcase className="size-4 text-violet-500" aria-hidden />
                  <h3 className="font-bold">{t(`roles.${slug}.title`)}</h3>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{t(`roles.${slug}.summary`)}</p>
                <div className="flex flex-wrap gap-3 text-xs font-medium text-zinc-500">
                  <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 dark:bg-zinc-800">
                    <MapPin className="size-3" aria-hidden />
                    {t(`roles.${slug}.location`)}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 dark:bg-zinc-800">
                    {t(`roles.${slug}.type`)}
                  </span>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-emerald-700 dark:text-emerald-300">
                    {t(`roles.${slug}.team`)}
                  </span>
                </div>
                <ul className="mt-3 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {(["r1", "r2", "r3"] as const).map((req) => (
                    <li key={req} className="flex gap-2">
                      <span className="text-violet-500">·</span>
                      {t(`roles.${slug}.requirements.${req}`)}
                    </li>
                  ))}
                </ul>
              </div>
              <a
                href={`mailto:careers@affisell.com?subject=${encodeURIComponent(t(`roles.${slug}.applySubject`))}`}
                className={cn(
                  "inline-flex shrink-0 items-center justify-center rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
                )}
              >
                {t("apply")}
                <ArrowRight className="ml-1 size-4" aria-hidden />
              </a>
            </BentoCard>
          ))}
        </div>

        <BentoCard className="text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("spontaneous")}</p>
          <a
            href={`mailto:careers@affisell.com`}
            className="mt-2 inline-block font-semibold text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
          >
            careers@affisell.com
          </a>
          <p className="mt-3 text-xs text-zinc-500">{legal.companyName} · {legal.address}</p>
        </BentoCard>
      </BentoContainer>
    </BentoShell>
  )
}

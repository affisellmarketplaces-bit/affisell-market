import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { Download, Mail, Newspaper } from "lucide-react"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { CompanyNav } from "@/components/company/company-nav"
import { LiveStatsStrip } from "@/components/company/live-stats-strip"
import { readAffisellLegalEntity } from "@/lib/legal/company-env"
import { cn } from "@/lib/utils"

export async function generateMetadata() {
  const t = await getTranslations("companyPages.press")
  return { title: t("metaTitle"), description: t("metaDescription") }
}

export default async function PressPage() {
  const t = await getTranslations("companyPages.press")
  const legal = readAffisellLegalEntity()

  return (
    <BentoShell>
      <BentoContainer maxWidth="5xl" className="space-y-10 py-12">
        <CompanyNav active="press" />
        <BentoPageHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />

        <LiveStatsStrip />

        <BentoCard className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Newspaper className="size-5 text-violet-500" aria-hidden />
            {t("boilerplate.title")}
          </h2>
          <p className="rounded-2xl bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            {t("boilerplate.short")}
          </p>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t("boilerplate.long")}</p>
        </BentoCard>

        <div className="grid gap-4 md:grid-cols-2">
          <BentoCard className="space-y-3">
            <h3 className="font-bold">{t("facts.title")}</h3>
            <dl className="space-y-2 text-sm">
              {(["founded", "hq", "model", "stack", "compliance"] as const).map((key) => (
                <div key={key} className="flex gap-2">
                  <dt className="w-28 shrink-0 font-medium text-zinc-500">{t(`facts.${key}.label`)}</dt>
                  <dd className="text-zinc-800 dark:text-zinc-200">{t(`facts.${key}.value`)}</dd>
                </div>
              ))}
            </dl>
          </BentoCard>

          <BentoCard className="space-y-4">
            <h3 className="font-bold">{t("assets.title")}</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("assets.description")}</p>
            <ul className="space-y-2">
              {(["logo", "screenshots", "founder"] as const).map((key) => (
                <li key={key}>
                  <a
                    href={`mailto:press@affisell.com?subject=${encodeURIComponent(t(`assets.items.${key}.subject`))}`}
                    className="inline-flex items-center gap-2 text-sm font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
                  >
                    <Download className="size-4" aria-hidden />
                    {t(`assets.items.${key}.label`)}
                  </a>
                </li>
              ))}
            </ul>
          </BentoCard>
        </div>

        <BentoCard className="space-y-4">
          <h3 className="font-bold">{t("news.title")}</h3>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {(["n1", "n2", "n3"] as const).map((key) => (
              <li key={key} className="flex flex-col gap-1 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{t(`news.items.${key}.title`)}</p>
                  <p className="text-sm text-zinc-500">{t(`news.items.${key}.date`)}</p>
                </div>
                <Link
                  href={t(`news.items.${key}.href`)}
                  className="text-sm font-semibold text-violet-700 hover:underline dark:text-violet-300"
                >
                  {t("news.read")}
                </Link>
              </li>
            ))}
          </ul>
        </BentoCard>

        <BentoCard className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-bold">
              <Mail className="size-5 text-violet-500" aria-hidden />
              {t("contact.title")}
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t("contact.body")}</p>
          </div>
          <a
            href="mailto:press@affisell.com"
            className={cn(
              "inline-flex items-center justify-center rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
            )}
          >
            press@affisell.com
          </a>
        </BentoCard>

        <p className="text-center text-xs text-zinc-500">
          {legal.companyName} · SIREN {legal.siren} · {t("legalNote")}{" "}
          <Link href="/mentions-legales" className="underline underline-offset-2">
            {t("legalLink")}
          </Link>
        </p>
      </BentoContainer>
    </BentoShell>
  )
}

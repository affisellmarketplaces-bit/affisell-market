import Link from "next/link"
import { getTranslations } from "next-intl/server"
import type { ReactNode } from "react"

import { BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { cn } from "@/lib/utils"

const LEGAL_NAV = [
  { href: "/cgv", key: "cgv" },
  { href: "/cgu", key: "cgu" },
  { href: "/conditions-fournisseur", key: "supplier" },
  { href: "/conditions-affilie", key: "affiliate" },
  { href: "/mentions-legales", key: "legalNotice" },
  { href: "/privacy", key: "privacy" },
  { href: "/cookies", key: "cookies" },
  { href: "/returns", key: "returns" },
  { href: "/contact", key: "contact" },
] as const

type Props = {
  title: string
  description?: string
  lastUpdated?: string
  children: ReactNode
}

export async function LegalPageShell({ title, description, lastUpdated, children }: Props) {
  const t = await getTranslations("legal.nav")

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="py-10 sm:py-14">
        <nav aria-label={t("ariaLabel")} className="mb-8 flex flex-wrap gap-2">
          {LEGAL_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-violet-300 hover:text-violet-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-violet-700 dark:hover:text-violet-200"
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <header className="mb-8 border-b border-zinc-200 pb-6 dark:border-zinc-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            {t("eyebrow")}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">{title}</h1>
          {description ? (
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{description}</p>
          ) : null}
          {lastUpdated ? (
            <p className="mt-2 text-xs text-zinc-500">{t("lastUpdated", { date: lastUpdated })}</p>
          ) : null}
        </header>

        <article
          className={cn(
            "legal-prose prose-zinc max-w-none dark:prose-invert",
            "prose-headings:font-semibold prose-h2:mt-8 prose-h2:text-lg prose-h3:text-base",
            "prose-p:text-sm prose-p:leading-relaxed prose-li:text-sm",
            "prose-a:text-violet-700 prose-a:no-underline hover:prose-a:underline dark:prose-a:text-violet-300"
          )}
        >
          {children}
        </article>
      </BentoContainer>
    </BentoShell>
  )
}

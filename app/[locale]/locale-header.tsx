"use client"

import { useLocale, useTranslations } from "next-intl"

import { Link, usePathname } from "@/i18n/navigation"
import { routing } from "@/i18n/routing"

export function LocaleHeader() {
  const locale = useLocale()
  const pathname = usePathname()
  const t = useTranslations("nav")

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm md:px-8">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/" className="font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {t("brand")}
          </Link>
          <Link href="/" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            {t("home")}
          </Link>
          <Link href="/dashboard" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            {t("dashboard")}
          </Link>
          <Link href="/dashboard/affiliate" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            {t("affiliateArea")}
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2" aria-label={t("language")}>
          {routing.locales.map((loc) => (
            <Link
              key={loc}
              href={pathname || "/"}
              locale={loc}
              className={
                locale === loc
                  ? "rounded-md bg-zinc-900 px-3 py-1 font-medium uppercase text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "rounded-md px-3 py-1 uppercase text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }
            >
              {loc}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  )
}

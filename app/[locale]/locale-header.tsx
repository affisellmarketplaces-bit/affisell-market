"use client"

import { useTranslations } from "next-intl"

import { Link } from "@/i18n/navigation"

export function LocaleHeader() {
  const t = useTranslations("nav")

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm md:px-8">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/" className="font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {t("brand")}
          </Link>
          <Link href="/marketplace" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            {t("marketplace")}
          </Link>
          <Link href="/dashboard" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            {t("dashboard")}
          </Link>
          <Link href="/login" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            {t("login")}
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {t("signup")}
          </Link>
        </div>
      </nav>
    </header>
  )
}

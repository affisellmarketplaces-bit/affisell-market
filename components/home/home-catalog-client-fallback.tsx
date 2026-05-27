"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"

type Props = {
  message?: string | null
  onRetry?: () => void
}

export function HomeCatalogClientFallback({ message, onRetry }: Props) {
  const t = useTranslations("home.catalogError")

  return (
    <section
      id="explorer"
      className="scroll-mt-24 rounded-3xl border border-dashed border-violet-300/40 bg-violet-50/50 px-6 py-10 text-center dark:border-violet-500/30 dark:bg-violet-950/20"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">
        {t("eyebrow")}
      </p>
      <h2 className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-50">{t("title")}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">{t("body")}</p>
      {message ? (
        <p className="mx-auto mt-2 max-w-md font-mono text-[10px] text-zinc-400">{message}</p>
      ) : null}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900"
          >
            {t("retry")}
          </button>
        ) : null}
        <Link
          href="/marketplace"
          className="inline-flex rounded-xl border border-zinc-300 px-5 py-2.5 text-sm font-medium dark:border-zinc-600"
        >
          {t("browse")}
        </Link>
      </div>
    </section>
  )
}

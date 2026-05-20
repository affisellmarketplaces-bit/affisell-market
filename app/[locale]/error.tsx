"use client"

import * as Sentry from "@sentry/nextjs"
import Image from "next/image"
import { useEffect } from "react"
import { useTranslations } from "next-intl"

import { Link } from "@/i18n/navigation"

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations("errors.page")

  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      <Image
        src="/illustrations/empty-search.svg"
        alt=""
        width={200}
        height={160}
        loading="eager"
        priority
      />
      <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-[#6366F1]">
        {t("label")}
      </p>
      <h1 className="mt-2 text-2xl font-bold">{t("title")}</h1>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{t("body")}</p>
      {error.digest ? <p className="mt-2 font-mono text-xs text-zinc-400">Ref: {error.digest}</p> : null}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900"
        >
          {t("retry")}
        </button>
        <Link href="/" className="rounded-xl border px-5 py-2.5 text-sm font-medium">
          {t("home")}
        </Link>
      </div>
    </main>
  )
}

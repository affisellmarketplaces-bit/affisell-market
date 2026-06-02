"use client"

import { useTranslations } from "next-intl"
import Image from "next/image"

import { Link } from "@/i18n/navigation"

export default function LocaleNotFound() {
  const t = useTranslations("errors.notFound")

  return (
    <main className="affisell-error-main items-center text-center">
      <Image
        src="/illustrations/empty-search.svg"
        alt=""
        width={200}
        height={160}
        loading="eager"
        priority
      />
      <h1 className="mt-6 text-2xl font-bold">{t("title")}</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t("body")}</p>
      <Link
        href="/"
        className="mt-8 inline-flex rounded-2xl bg-[#6366F1] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#5558E3]"
      >
        {t("home")}
      </Link>
    </main>
  )
}

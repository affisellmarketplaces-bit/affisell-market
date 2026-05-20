"use client"

import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

import {
  LOCALE_COOKIE,
  localeCookieMaxAgeSec,
  type AppLocale,
} from "@/lib/i18n-locale"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
}

function setLocaleCookie(locale: AppLocale) {
  document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=${localeCookieMaxAgeSec()};SameSite=Lax`
}

export function LocaleSwitcher({ className }: Props) {
  const locale = useLocale() as AppLocale
  const t = useTranslations("CommandK")
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function select(next: AppLocale) {
    if (next === locale) return
    setLocaleCookie(next)
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div
      className={cn(
        "inline-flex rounded-full border border-zinc-200/90 bg-zinc-50/90 p-0.5 text-[11px] font-semibold dark:border-zinc-700 dark:bg-zinc-900/80",
        pending && "opacity-60",
        className
      )}
      role="group"
      aria-label={t("languageSwitcher")}
    >
      <button
        type="button"
        onClick={() => select("en")}
        className={cn(
          "rounded-full px-2 py-1 transition",
          locale === "en"
            ? "bg-violet-600 text-white"
            : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        )}
        aria-pressed={locale === "en"}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => select("fr")}
        className={cn(
          "rounded-full px-2 py-1 transition",
          locale === "fr"
            ? "bg-violet-600 text-white"
            : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        )}
        aria-pressed={locale === "fr"}
      >
        FR
      </button>
    </div>
  )
}

"use client"

import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { motion } from "framer-motion"

import {
  LOCALE_COOKIE,
  localeCookieMaxAgeSec,
  type AppLocale,
} from "@/lib/i18n-locale"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
}

const FLAGS: Record<AppLocale, string> = {
  en: "🇬🇧",
  fr: "🇫🇷",
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
        "relative inline-flex rounded-full border border-zinc-200/90 bg-zinc-50/90 p-0.5 text-[11px] font-semibold dark:border-zinc-700 dark:bg-zinc-900/80",
        pending && "opacity-60",
        className
      )}
      role="group"
      aria-label={t("languageSwitcher")}
    >
      {(["en", "fr"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => select(code)}
          className={cn(
            "relative z-10 rounded-full px-2.5 py-1 transition-colors",
            locale === code
              ? "text-white"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          )}
          aria-pressed={locale === code}
        >
          <motion.span
            animate={{ scale: locale === code ? 1.15 : 1, rotate: locale === code ? [0, -8, 8, 0] : 0 }}
            transition={{ duration: 0.35 }}
            className="inline-block"
          >
            {FLAGS[code]}
          </motion.span>
          <span className="sr-only">{code.toUpperCase()}</span>
        </button>
      ))}
      <motion.span
        layoutId="locale-pill"
        className="absolute inset-y-0.5 w-[calc(50%-2px)] rounded-full bg-violet-600"
        style={{ left: locale === "en" ? 2 : "calc(50%)" }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        aria-hidden
      />
    </div>
  )
}

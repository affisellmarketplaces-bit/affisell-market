"use client"

import { useState, useTransition } from "react"
import { useLocale, useTranslations } from "next-intl"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown } from "lucide-react"

import { usePathname, useRouter } from "@/i18n/navigation"
import { LOCALE_COOKIE, localeCookieMaxAgeSec, type AppLocale } from "@/lib/i18n-locale"
import { cn } from "@/lib/utils"

const FLAGS: Record<AppLocale, string> = { en: "🇬🇧", fr: "🇫🇷" }
const LABELS: Record<AppLocale, string> = { en: "English", fr: "Français" }

const MARKETING_PATHS = new Set(["/", "/creators", "/partners"])

function setLocaleCookie(locale: AppLocale) {
  document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=${localeCookieMaxAgeSec()};SameSite=Lax`
}

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as AppLocale
  const t = useTranslations("CommandK")
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function select(next: AppLocale) {
    if (next === locale) return
    setLocaleCookie(next)
    setOpen(false)
    startTransition(() => {
      if (MARKETING_PATHS.has(pathname)) {
        router.replace(pathname, { locale: next })
      }
      router.refresh()
    })
  }

  return (
    <div className={cn("relative", pending && "opacity-70", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/90 bg-zinc-50/90 px-3 py-1.5 text-xs font-semibold dark:border-zinc-700 dark:bg-zinc-900/80"
        aria-label={t("languageSwitcher")}
        aria-expanded={open}
      >
        <motion.span
          key={locale}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-base"
        >
          {FLAGS[locale]}
        </motion.span>
        <span className="hidden sm:inline">{locale.toUpperCase()}</span>
        <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.ul
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-50 mt-1 min-w-[8.5rem] overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-950"
            role="listbox"
          >
            {(["en", "fr"] as const).map((code) => (
              <li key={code} role="option" aria-selected={locale === code}>
                <button
                  type="button"
                  onClick={() => select(code)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-zinc-50 dark:hover:bg-zinc-900",
                    locale === code && "bg-violet-50 text-violet-700 dark:bg-violet-950/50"
                  )}
                >
                  <span>{FLAGS[code]}</span>
                  {LABELS[code]}
                </button>
              </li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

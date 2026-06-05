"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { usePathname } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown } from "lucide-react"

import { hrefForLocaleSwitch } from "@/lib/client-locale-path"
import { isDemoLabRoute } from "@/lib/demo/demo-routes"
import {
  LOCALE_COOKIE,
  SUPPORTED_LOCALES,
  localeCookieMaxAgeSec,
  type AppLocale,
} from "@/lib/i18n-locale"
import { LOCALE_FLAGS, LOCALE_LABELS } from "@/lib/i18n-locale-meta"
import { cn } from "@/lib/utils"

function setLocaleCookie(locale: AppLocale) {
  const maxAge = localeCookieMaxAgeSec()
  document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=${maxAge};SameSite=Lax`
  document.cookie = `NEXT_LOCALE=;path=/;max-age=0;SameSite=Lax`
}

const MENU_ESTIMATED_HEIGHT_PX = 92

type MenuPosition = {
  top?: number
  bottom?: number
  left: number
  minWidth: number
  openUpward: boolean
}

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as AppLocale
  const pathname = usePathname() ?? ""
  const t = useTranslations("CommandK")
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)

  const updateMenuPosition = useCallback(() => {
    const btn = btnRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    const spaceBelow = window.innerHeight - r.bottom
    const openUpward =
      isDemoLabRoute(pathname) || spaceBelow < MENU_ESTIMATED_HEIGHT_PX + 12
    const left = r.right
    const minWidth = Math.max(r.width, 136)

    if (openUpward) {
      setMenuPos({
        bottom: window.innerHeight - r.top + 4,
        left,
        minWidth,
        openUpward: true,
      })
      return
    }

    setMenuPos({
      top: r.bottom + 4,
      left,
      minWidth,
      openUpward: false,
    })
  }, [pathname])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    updateMenuPosition()
    window.addEventListener("resize", updateMenuPosition)
    window.addEventListener("scroll", updateMenuPosition, true)
    return () => {
      window.removeEventListener("resize", updateMenuPosition)
      window.removeEventListener("scroll", updateMenuPosition, true)
    }
  }, [open, updateMenuPosition])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      const target = e.target
      if (!(target instanceof Node)) return
      if (btnRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  function select(next: AppLocale) {
    if (next === locale) return
    setOpen(false)
    const { pathname, search, hash } = window.location
    const target = hrefForLocaleSwitch(pathname, search, hash, next)
    setLocaleCookie(next)
    window.location.replace(target)
  }

  const menuPortal =
    mounted && menuPos ? (
      <AnimatePresence>
        {open ? (
          <motion.ul
            ref={menuRef}
            initial={{ opacity: 0, y: menuPos.openUpward ? -4 : 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: menuPos.openUpward ? -4 : 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="affisell-locale-menu fixed z-[9999] max-h-[min(70dvh,20rem)] overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-950"
            style={{
              top: menuPos.openUpward ? undefined : menuPos.top,
              bottom: menuPos.openUpward ? menuPos.bottom : undefined,
              left: menuPos.left,
              minWidth: menuPos.minWidth,
              transform: "translateX(-100%)",
            }}
            role="listbox"
          >
            {SUPPORTED_LOCALES.map((code) => (
              <li key={code} role="option" aria-selected={locale === code}>
                <button
                  type="button"
                  onClick={() => select(code)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-zinc-50 dark:hover:bg-zinc-900",
                    locale === code && "bg-violet-50 text-violet-700 dark:bg-violet-950/50"
                  )}
                >
                  <span>{LOCALE_FLAGS[code]}</span>
                  {LOCALE_LABELS[code]}
                </button>
              </li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    ) : null

  return (
    <div className={cn("relative", className)}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          setOpen((o) => {
            const next = !o
            if (next) updateMenuPosition()
            return next
          })
        }}
        className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/90 bg-zinc-50/90 px-3 py-1.5 text-xs font-semibold dark:border-zinc-700 dark:bg-zinc-900/80"
        aria-label={t("languageSwitcher")}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="text-base" aria-hidden>
          {LOCALE_FLAGS[locale]}
        </span>
        <span className="hidden sm:inline">{locale.toUpperCase()}</span>
        <ChevronDown
          className={cn("h-3 w-3 opacity-60 transition", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {menuPortal ? createPortal(menuPortal, document.body) : null}
    </div>
  )
}

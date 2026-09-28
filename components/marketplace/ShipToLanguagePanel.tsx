"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useLocale, useTranslations } from "next-intl"
import { ChevronDown, Globe2 } from "lucide-react"

import { useVisitorCheckoutRegion } from "@/hooks/use-visitor-checkout-region"
import { hrefForLocaleSwitch } from "@/lib/client-locale-path"
import { stripeCheckoutAllowedCountriesForRegion } from "@/lib/eu-market-countries"
import { LOCALE_COOKIE, localeCookieMaxAgeSec, type AppLocale } from "@/lib/i18n-locale"
import { LOCALE_FLAGS, LOCALE_LABELS } from "@/lib/i18n-locale-meta"
import { LOCALE_SWITCHER_OPTIONS } from "@/lib/i18n-ui-locale"
import { MARKET_REGION } from "@/lib/market-config"
import { visitorCountryDisplayName } from "@/lib/visitor-country"
import { readShipsToFromDocumentCookie, writeShipsToDocumentCookie } from "@/lib/ships-to-preference"
import { cn } from "@/lib/utils"

/** ISO-3166 alpha-2 → flag emoji (regional indicator pair) — no hardcoded flag table to maintain. */
function flagEmoji(iso2: string): string {
  const code = iso2.toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return "🌐"
  const base = 0x1f1e6
  return String.fromCodePoint(...[...code].map((c) => base + (c.charCodeAt(0) - 65)))
}

const MENU_WIDTH_PX = 320

type MenuPosition = { top: number; left: number }

/**
 * Combined "Ship to" + "Language" popover — same spot and spirit as AliExpress's
 * Country/Language/Currency button, minus a Currency picker: Affisell prices are a single
 * deployment-wide currency (see market-config.ts), so a real per-visitor currency switch would
 * need converting every displayed price and is a separate, much larger project — not faked here.
 *
 * "Ship to" only pre-fills the existing, harmless catalog `shipsTo` filter (what listings to show).
 * It is never wired into checkout/payment-country eligibility, which stays strictly IP-resolved
 * server-side for compliance.
 */
export function ShipToLanguagePanel() {
  const locale = useLocale() as AppLocale
  const t = useTranslations("PublicNav.shipToLanguage")
  const { country: detectedCountry } = useVisitorCheckoutRegion()

  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null)
  const [country, setCountry] = useState<string | null>(null)
  const [pendingCountry, setPendingCountry] = useState<string | null>(null)
  const [pendingLocale, setPendingLocale] = useState<AppLocale>(locale)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    setCountry(readShipsToFromDocumentCookie() ?? detectedCountry ?? null)
  }, [detectedCountry])

  const countryOptions = stripeCheckoutAllowedCountriesForRegion(MARKET_REGION)

  const updateMenuPosition = useCallback(() => {
    const btn = btnRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    setMenuPos({ top: r.bottom + 8, left: Math.max(8, r.right - MENU_WIDTH_PX) })
  }, [])

  const openPanel = useCallback(() => {
    setPendingCountry(country)
    setPendingLocale(locale)
    updateMenuPosition()
    setOpen(true)
  }, [country, locale, updateMenuPosition])

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
      if (!(e.target instanceof Node)) return
      if (btnRef.current?.contains(e.target)) return
      if (panelRef.current?.contains(e.target)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  function save() {
    if (pendingCountry) writeShipsToDocumentCookie(pendingCountry)

    const { pathname: loc, search, hash } = window.location
    let target = hrefForLocaleSwitch(loc, search, hash, pendingLocale)
    if (pendingCountry) {
      const url = new URL(target, window.location.origin)
      url.searchParams.set("shipsTo", pendingCountry.toLowerCase())
      target = `${url.pathname}${url.search}${url.hash}`
    }

    if (pendingLocale !== locale) {
      const maxAge = localeCookieMaxAgeSec()
      document.cookie = `${LOCALE_COOKIE}=${pendingLocale};path=/;max-age=${maxAge};SameSite=Lax`
      document.cookie = `NEXT_LOCALE=;path=/;max-age=0;SameSite=Lax`
    }

    setOpen(false)
    // Full navigation — same discipline as the plain locale switcher: locale-dependent server
    // content must never be patched client-side (see the App Router hydration fix earlier this
    // project needed for exactly that class of bug).
    window.location.assign(target)
  }

  const currentFlag = country ? flagEmoji(country) : "🌐"
  const currentCountryLabel = country ? visitorCountryDisplayName(country, locale) : t("chooseCountry")

  const panel =
    mounted && open && menuPos
      ? createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={t("title")}
            style={{ top: menuPos.top, left: menuPos.left, width: MENU_WIDTH_PX }}
            className="fixed z-[300] rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl shadow-violet-950/10 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <p className="mb-2 text-sm font-bold text-zinc-900 dark:text-zinc-50">{t("shipToTitle")}</p>
            <ul className="mb-4 max-h-48 space-y-0.5 overflow-y-auto" role="listbox">
              {countryOptions.map((code) => (
                <li key={code} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={pendingCountry === code}
                    onClick={() => setPendingCountry(code)}
                    className={cn(
                      "flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition",
                      pendingCountry === code
                        ? "bg-violet-50 font-semibold text-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
                        : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    )}
                  >
                    <span aria-hidden>{flagEmoji(code)}</span>
                    <span className="min-w-0 truncate">{visitorCountryDisplayName(code, locale)}</span>
                  </button>
                </li>
              ))}
            </ul>

            <p className="mb-2 text-sm font-bold text-zinc-900 dark:text-zinc-50">{t("languageTitle")}</p>
            <ul className="mb-4 grid grid-cols-2 gap-1.5" role="listbox">
              {LOCALE_SWITCHER_OPTIONS.map((code) => (
                <li key={code} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={pendingLocale === code}
                    onClick={() => setPendingLocale(code)}
                    className={cn(
                      "flex min-h-9 w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition",
                      pendingLocale === code
                        ? "bg-violet-50 font-semibold text-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
                        : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    )}
                  >
                    <span aria-hidden>{LOCALE_FLAGS[code]}</span>
                    <span className="min-w-0 truncate">{LOCALE_LABELS[code]}</span>
                  </button>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={save}
              className="flex min-h-10 w-full items-center justify-center rounded-full bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-700"
            >
              {t("save")}
            </button>
          </div>,
          document.body
        )
      : null

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-zinc-200/90 bg-white px-2.5 text-xs font-semibold text-zinc-700 shadow-sm transition hover:border-violet-300 hover:text-violet-800 dark:border-zinc-700/90 dark:bg-zinc-900/90 dark:text-zinc-200 dark:hover:border-violet-500/50"
      >
        <Globe2 className="size-3.5 shrink-0 opacity-70" aria-hidden />
        <span aria-hidden>{currentFlag}</span>
        <span className="hidden sm:inline">{locale.toUpperCase()}</span>
        <ChevronDown className={cn("size-3 opacity-60 transition", open && "rotate-180")} aria-hidden />
        <span className="sr-only">
          {t("triggerLabel", { country: currentCountryLabel, language: LOCALE_LABELS[locale] })}
        </span>
      </button>
      {panel}
    </div>
  )
}

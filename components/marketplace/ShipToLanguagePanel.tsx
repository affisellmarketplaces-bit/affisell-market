"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useLocale, useTranslations } from "next-intl"
import { ChevronDown, Globe2, Loader2 } from "lucide-react"

import { useVisitorCheckoutRegion } from "@/hooks/use-visitor-checkout-region"
import { hrefForLocaleSwitch } from "@/lib/client-locale-path"
import { stripeCheckoutAllowedCountriesForRegion } from "@/lib/eu-market-countries"
import { LOCALE_COOKIE, localeCookieMaxAgeSec, type AppLocale } from "@/lib/i18n-locale"
import { LOCALE_FLAGS, LOCALE_LABELS } from "@/lib/i18n-locale-meta"
import { LOCALE_SWITCHER_OPTIONS } from "@/lib/i18n-ui-locale"
import { MARKET_REGION } from "@/lib/market-config"
import { visitorCountryDisplayName } from "@/lib/visitor-country"
import {
  clearShipsToCityDocumentCookie,
  readShipsToCityFromDocumentCookie,
  readShipsToFromDocumentCookie,
  writeShipsToCityDocumentCookie,
  writeShipsToDocumentCookie,
} from "@/lib/ships-to-preference"
import { cn } from "@/lib/utils"

/** ISO-3166 alpha-2 → flag emoji (regional indicator pair) — no hardcoded flag table to maintain. */
function flagEmoji(iso2: string): string {
  const code = iso2.toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return "🌐"
  const base = 0x1f1e6
  return String.fromCodePoint(...[...code].map((c) => base + (c.charCodeAt(0) - 65)))
}

const MENU_WIDTH_PX = 320
const CITY_QUERY_DEBOUNCE_MS = 350
const CITY_MIN_QUERY_LEN = 2

type MenuPosition = { top: number; left: number }
type CitySuggestion = { label: string; city: string; region: string | null; countryCode: string }

/**
 * Combined "Ship to" + "Language" popover — same spot and spirit as AliExpress's
 * Country/Language/Currency button, minus a Currency picker: Affisell prices are a single
 * deployment-wide currency (see market-config.ts), so a real per-visitor currency switch would
 * need converting every displayed price and is a separate, much larger project — not faked here.
 *
 * "Ship to" only pre-fills the existing, harmless catalog `shipsTo` filter (what listings to show).
 * It is never wired into checkout/payment-country eligibility, which stays strictly IP-resolved
 * server-side for compliance.
 *
 * The city field (real Nominatim/OpenStreetMap autocomplete, see lib/city-suggest.ts) is a
 * display/personalization detail only — there is no city-level shipping field on Product, so it
 * never narrows the catalog; only the country does.
 */
export function ShipToLanguagePanel() {
  const locale = useLocale() as AppLocale
  const t = useTranslations("PublicNav.shipToLanguage")
  const { country: detectedCountry } = useVisitorCheckoutRegion()

  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null)
  const [country, setCountry] = useState<string | null>(null)
  const [city, setCity] = useState<string | null>(null)
  const [pendingCountry, setPendingCountry] = useState<string | null>(null)
  const [pendingLocale, setPendingLocale] = useState<AppLocale>(locale)
  const [pendingCity, setPendingCity] = useState("")
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([])
  const [cityLoading, setCityLoading] = useState(false)
  const [citySuggestionsOpen, setCitySuggestionsOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const cityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cityRequestSeqRef = useRef(0)
  const citySelectedRef = useRef(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    setCountry(readShipsToFromDocumentCookie() ?? detectedCountry ?? null)
    setCity(readShipsToCityFromDocumentCookie())
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
    setPendingCity(city ?? "")
    setCitySuggestions([])
    setCitySuggestionsOpen(false)
    citySelectedRef.current = false
    updateMenuPosition()
    setOpen(true)
  }, [country, locale, city, updateMenuPosition])

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

  // Debounced city autocomplete — real suggestions from Nominatim via our own proxy route.
  useEffect(() => {
    if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current)

    if (citySelectedRef.current) {
      citySelectedRef.current = false
      return
    }

    const query = pendingCity.trim()
    if (query.length < CITY_MIN_QUERY_LEN) {
      setCitySuggestions([])
      setCityLoading(false)
      return
    }

    setCityLoading(true)
    cityDebounceRef.current = setTimeout(() => {
      const seq = ++cityRequestSeqRef.current
      const params = new URLSearchParams({ q: query, locale })
      if (pendingCountry) params.set("country", pendingCountry)

      fetch(`/api/geo/city-suggest?${params.toString()}`)
        .then((res) => (res.ok ? res.json() : { suggestions: [] }))
        .then((data: { suggestions?: CitySuggestion[] }) => {
          if (seq !== cityRequestSeqRef.current) return
          setCitySuggestions(data.suggestions ?? [])
          setCitySuggestionsOpen(true)
        })
        .catch(() => {
          if (seq !== cityRequestSeqRef.current) return
          setCitySuggestions([])
        })
        .finally(() => {
          if (seq !== cityRequestSeqRef.current) return
          setCityLoading(false)
        })
    }, CITY_QUERY_DEBOUNCE_MS)

    return () => {
      if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pendingCountry intentionally re-scopes the search, not re-triggers on its own
  }, [pendingCity, locale])

  function selectCitySuggestion(suggestion: CitySuggestion) {
    citySelectedRef.current = true
    setPendingCity(suggestion.label)
    setCitySuggestions([])
    setCitySuggestionsOpen(false)
    if (!pendingCountry && suggestion.countryCode) setPendingCountry(suggestion.countryCode)
  }

  function save() {
    if (pendingCountry) writeShipsToDocumentCookie(pendingCountry)

    const trimmedCity = pendingCity.trim()
    if (trimmedCity) {
      writeShipsToCityDocumentCookie(trimmedCity)
    } else {
      clearShipsToCityDocumentCookie()
    }

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
  const currentCountryName = country ? visitorCountryDisplayName(country, locale) : t("chooseCountry")
  const currentCountryLabel = city ? `${city}, ${currentCountryName}` : currentCountryName

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
            <ul className="mb-3 max-h-40 space-y-0.5 overflow-y-auto" role="listbox">
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

            <div className="relative mb-4">
              <label htmlFor="ship-to-city-input" className="mb-1.5 block text-sm font-bold text-zinc-900 dark:text-zinc-50">
                {t("cityTitle")}
              </label>
              <div className="relative">
                <input
                  id="ship-to-city-input"
                  type="text"
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={citySuggestionsOpen && citySuggestions.length > 0}
                  aria-autocomplete="list"
                  aria-controls="ship-to-city-listbox"
                  value={pendingCity}
                  onChange={(e) => setPendingCity(e.target.value)}
                  onFocus={() => {
                    if (citySuggestions.length > 0) setCitySuggestionsOpen(true)
                  }}
                  placeholder={t("cityPlaceholder")}
                  className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-sm text-zinc-800 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-violet-900/40"
                />
                {cityLoading ? (
                  <Loader2 className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-zinc-400" aria-hidden />
                ) : null}
              </div>

              {citySuggestionsOpen && citySuggestions.length > 0 ? (
                <ul
                  id="ship-to-city-listbox"
                  role="listbox"
                  className="absolute inset-x-0 top-full z-10 mt-1 max-h-40 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
                >
                  {citySuggestions.map((s, i) => (
                    <li key={`${s.label}-${i}`} role="none">
                      <button
                        type="button"
                        role="option"
                        aria-selected={false}
                        onClick={() => selectCitySuggestion(s)}
                        className="flex min-h-8 w-full items-center px-2.5 py-1 text-left text-sm text-zinc-700 transition hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
                      >
                        <span className="min-w-0 truncate">{s.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {citySuggestionsOpen && !cityLoading && citySuggestions.length === 0 && pendingCity.trim().length >= CITY_MIN_QUERY_LEN ? (
                <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{t("noCityResults")}</p>
              ) : null}
            </div>

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

"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"

import { GlobeSidebar } from "@/components/radar/GlobeSidebar"
import { GlobeTicker } from "@/components/radar/GlobeTicker"
import type { LiveEvent } from "@/lib/radar/live-types"

function GlobeLoading() {
  const t = useTranslations("radarGlobe")
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#050507] text-sm text-white/50">
      {t("loading")}
    </div>
  )
}

const Globe3D = dynamic(() => import("@/components/radar/Globe3D"), {
  ssr: false,
  loading: () => <GlobeLoading />,
})

function webglSupported(): boolean {
  if (typeof window === "undefined") return false
  try {
    const canvas = document.createElement("canvas")
    return Boolean(
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl")
    )
  } catch {
    return false
  }
}

type LivePayload = {
  ok?: boolean
  events?: LiveEvent[]
  countries?: number
  source?: string
}

/**
 * Immersive Trust Radar Globe — client shell (poll /api/radar/live every 10s).
 */
export function GlobePageClient() {
  const t = useTranslations("radarGlobe")
  const [events, setEvents] = useState<LiveEvent[]>([])
  const [countries, setCountries] = useState(0)
  const [selected, setSelected] = useState<LiveEvent | null>(null)
  const [webgl, setWebgl] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/radar/live", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      })
      if (!res.ok) {
        setError("live_unavailable")
        return
      }
      const data = (await res.json()) as LivePayload
      if (Array.isArray(data.events)) {
        setEvents(data.events)
        setCountries(data.countries ?? 0)
        setError(null)
      }
    } catch {
      setError("network")
    }
  }, [])

  useEffect(() => {
    setWebgl(webglSupported())
    void refresh()
    const id = window.setInterval(() => void refresh(), 10_000)
    return () => window.clearInterval(id)
  }, [refresh])

  if (webgl === false) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#050507] px-6 text-center text-white">
        <p className="text-lg font-semibold">{t("noWebgl")}</p>
        <p className="max-w-md text-sm text-white/50">
          {t("noWebglHint")}
        </p>
        <Link
          href="/radar/map"
          className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black"
        >
          {t("mapCta")}
        </Link>
      </div>
    )
  }

  return (
    <div
      className="relative h-[100dvh] w-screen overflow-hidden bg-[#050507]"
      data-testid="radar-globe-page"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/70 to-transparent p-4 sm:p-6">
        <div className="pointer-events-auto flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">
                AFFISELL RADAR · LIVE
              </h1>
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
              </span>
            </div>
            <p className="mt-1 text-xs text-white/50">
              {t("status", { n: events.length, countries: countries || "—" })}
              {error ? t("degraded") : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/radar"
              className="rounded-full bg-white/10 px-4 py-2 text-xs text-white hover:bg-white/15"
            >
              {t("tableView")}
            </Link>
            <Link
              href="/radar/map"
              className="rounded-full bg-white/10 px-4 py-2 text-xs text-white hover:bg-white/15"
            >
              {t("map2d")}
            </Link>
            <Link
              href="/dropforge"
              className="rounded-full bg-white px-4 py-2 text-xs font-bold text-black"
            >
              {t("importWinner")}
            </Link>
          </div>
        </div>
      </div>

      {webgl ? <Globe3D events={events} onSelect={setSelected} /> : null}

      {selected ? (
        <GlobeSidebar event={selected} onClose={() => setSelected(null)} />
      ) : null}

      <GlobeTicker events={events} />
    </div>
  )
}

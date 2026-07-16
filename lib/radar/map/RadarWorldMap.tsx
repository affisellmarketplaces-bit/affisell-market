"use client"

import { geoMercator, geoPath } from "d3-geo"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { feature } from "topojson-client"
import type { Topology } from "topojson-specification"
import type { FeatureCollection, Geometry } from "geojson"

import {
  MOCK_MAP_STATS,
  WORLD_GEO_JSON_URL,
  countryCodeToName,
  getCountryCoords,
  markerRadius,
  salesToHeatColor,
  type CountryMapStat,
} from "@/lib/radar/map/geo"
import { cn } from "@/lib/utils"

const WIDTH = 960
const HEIGHT = 480

type TooltipState = {
  x: number
  y: number
  stat: CountryMapStat
} | null

export default function RadarWorldMap({
  stats,
  demo = false,
  className,
}: {
  stats: CountryMapStat[]
  demo?: boolean
  className?: string
}) {
  const router = useRouter()
  const [geographies, setGeographies] = useState<FeatureCollection<Geometry> | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState>(null)
  const [loadError, setLoadError] = useState(false)

  const data = stats.length > 0 ? stats : MOCK_MAP_STATS
  const maxCount = Math.max(...data.map((d) => d.count), 1)
  const maxAvg = Math.max(...data.map((d) => d.avgSales), 1)

  useEffect(() => {
    let cancelled = false
    fetch(WORLD_GEO_JSON_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`geo ${r.status}`)
        return r.json()
      })
      .then((topo: Topology) => {
        if (cancelled) return
        const countries = topo.objects.countries
        if (!countries) throw new Error("missing countries")
        const fc = feature(topo, countries) as unknown as FeatureCollection<Geometry>
        setGeographies(fc)
      })
      .catch((err) => {
        console.warn("[radar/map]", {
          result: "geo_load_failed",
          message: err instanceof Error ? err.message : "unknown",
        })
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const projection = useMemo(
    () =>
      geoMercator()
        .scale(140)
        .translate([WIDTH / 2, HEIGHT / 2 + 40]),
    []
  )
  const path = useMemo(() => geoPath(projection), [projection])

  const markers = data
    .map((stat) => {
      const coords = getCountryCoords(stat.country)
      if (!coords) return null
      const projected = projection(coords)
      if (!projected) return null
      return { stat, x: projected[0], y: projected[1] }
    })
    .filter((m): m is { stat: CountryMapStat; x: number; y: number } => m != null)

  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-zinc-800 bg-[#0b1220]", className)}>
      {(demo || stats.length === 0) && (
        <p className="absolute left-3 top-3 z-10 rounded bg-amber-500/20 px-2 py-1 text-[11px] font-medium text-amber-200">
          Mode demo — données mock
        </p>
      )}
      {loadError && (
        <p className="absolute right-3 top-3 z-10 rounded bg-red-500/20 px-2 py-1 text-[11px] text-red-200">
          Geo CDN indisponible — markers seuls
        </p>
      )}

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label="Radar world map">
        <rect width={WIDTH} height={HEIGHT} fill="#0b1220" />
        {geographies?.features.map((geo, i) => (
          <path
            key={geo.id ?? i}
            d={path(geo) ?? undefined}
            fill="#1e293b"
            stroke="#334155"
            strokeWidth={0.4}
          />
        ))}

        {markers.map(({ stat, x, y }) => {
          const r = markerRadius(stat.count, maxCount)
          const color = salesToHeatColor(stat.avgSales, maxAvg)
          return (
            <g
              key={stat.country}
              transform={`translate(${x},${y})`}
              className="cursor-pointer"
              onMouseEnter={(e) => {
                const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
                const svg = e.currentTarget.ownerSVGElement
                if (!svg) return
                const pt = svg.createSVGPoint()
                pt.x = x
                pt.y = y
                setTooltip({
                  x: ((x / WIDTH) * rect.width),
                  y: ((y / HEIGHT) * rect.height),
                  stat,
                })
              }}
              onMouseLeave={() => setTooltip(null)}
              onClick={() => router.push(`/radar?country=${encodeURIComponent(stat.country)}`)}
            >
              <circle r={r * 1.8} fill={color} opacity={0.25}>
                <animate attributeName="r" values={`${r};${r * 2.2};${r}`} dur="2.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.35;0.05;0.35" dur="2.4s" repeatCount="indefinite" />
              </circle>
              <circle r={r} fill={color} stroke="#0b1220" strokeWidth={1.5} />
            </g>
          )
        })}
      </svg>

      {tooltip && (
        <div
          className="pointer-events-none absolute z-20 max-w-xs rounded-lg border border-zinc-600 bg-zinc-950/95 px-3 py-2 text-xs text-zinc-100 shadow-lg"
          style={{
            left: Math.min(tooltip.x + 12, 280),
            top: Math.max(tooltip.y - 8, 8),
          }}
        >
          <p className="font-semibold">
            {countryCodeToName(tooltip.stat.country)} ({tooltip.stat.country})
          </p>
          <p className="mt-1 text-zinc-300">
            {tooltip.stat.count} produits — {Math.round(tooltip.stat.avgSales).toLocaleString("fr-FR")}{" "}
            ventes/j avg
          </p>
          {tooltip.stat.topProductTitle && (
            <p className="mt-1 text-emerald-300">Top: {tooltip.stat.topProductTitle}</p>
          )}
        </div>
      )}
    </div>
  )
}

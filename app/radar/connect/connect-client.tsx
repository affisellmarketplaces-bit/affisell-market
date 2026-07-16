"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"

import {
  GOOGLE_CONNECTORS,
  REGION_FLAGS,
  REGION_LABELS,
  groupMarketplacesByRegion,
  isConnectorLive,
} from "@/lib/radar/connectors/registry"
import type { MarketplaceConnector } from "@/lib/radar/connectors/types"

function ConnectorCard({
  connector,
  href,
  enabled,
}: {
  connector: { id: string; name: string; logo: string; region?: string }
  href: string
  enabled: boolean
}) {
  return (
    <article className="flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>
          {connector.logo}
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-zinc-900">{connector.name}</h3>
          {connector.region && (
            <p className="mt-0.5 text-xs text-zinc-500">{connector.region}</p>
          )}
        </div>
      </div>
      {enabled ? (
        <Link
          href={href}
          className="mt-4 inline-flex justify-center rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Connect
        </Link>
      ) : (
        <button
          type="button"
          disabled
          className="mt-4 inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-400"
        >
          Connect
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
            Bientôt
          </span>
        </button>
      )}
    </article>
  )
}

export default function RadarConnectClient() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")
  const byRegion = groupMarketplacesByRegion()

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Connecter une source au Radar</h2>
        <p className="mt-2 text-sm text-zinc-600">
          TikTok Shop et Amazon SP-API sont disponibles. Les autres connecteurs arrivent progressivement.
        </p>
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Connexion échouée ({error}). Réessayez ou contactez le support.
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Google — Où on te trouve
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GOOGLE_CONNECTORS.map((c) => (
            <ConnectorCard
              key={c.id}
              connector={c}
              href={`/api/radar/google/start?connectorId=${encodeURIComponent(c.id)}`}
              enabled={false}
            />
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Marketplaces — Où tu vends
        </h2>
        {Array.from(byRegion.entries()).map(([region, connectors]) => (
          <div key={region} className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-800">
              <span aria-hidden>{REGION_FLAGS[region] ?? "🌍"}</span>
              {REGION_LABELS[region]}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {connectors.map((c: MarketplaceConnector) => {
                const live = isConnectorLive(c.id)
                const href =
                  c.id === "tiktok_shop"
                    ? "/api/radar/tiktok/start"
                    : c.id === "amazon"
                      ? "/api/radar/amazon/start"
                      : `/api/radar/${encodeURIComponent(c.id)}/start`
                return (
                  <ConnectorCard
                    key={c.id}
                    connector={{
                      id: c.id,
                      name: c.name,
                      logo: c.logo,
                      region: REGION_LABELS[c.region],
                    }}
                    href={href}
                    enabled={live}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}

"use client"

import { useSearchParams } from "next/navigation"

const SECTIONS = [
  {
    title: "Google",
    sources: ["Merchant Center", "Search Console"],
  },
  {
    title: "Marketplaces EU",
    sources: ["Amazon EU", "Allegro", "Bol.com"],
  },
  {
    title: "Marketplaces Americas",
    sources: ["Amazon US", "Walmart", "MercadoLibre"],
  },
  {
    title: "Marketplaces Asia",
    sources: ["Shopee", "Lazada"],
  },
  {
    title: "Marketplaces Africa & MENA",
    sources: ["Jumia", "Noon", "Takealot"],
  },
]

export default function RadarConnectPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  function startOAuth() {
    window.location.href = "/api/radar/tiktok/start"
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Connecter une source au Radar</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Commencez par TikTok Shop aujourd&apos;hui, puis étendez le Radar aux autres canaux.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Connexion échouée ({error}). Réessayez ou contactez le support.
          </div>
        )}

        <button
          type="button"
          onClick={startOAuth}
          className="mt-6 inline-flex rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Scanner un marketplace
        </button>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {SECTIONS.map((section) => (
          <article
            key={section.title}
            className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <h3 className="text-sm font-semibold text-zinc-900">{section.title}</h3>
            <ul className="mt-3 space-y-2 text-sm text-zinc-600">
              {section.sources.map((source) => (
                <li key={source} className="rounded-md bg-zinc-50 px-3 py-2">
                  {source}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </div>
  )
}

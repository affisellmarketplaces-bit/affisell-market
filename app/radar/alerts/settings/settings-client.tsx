"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import type { AlertSubscriptionFilters, Severity } from "@/lib/radar/alerts/types"

const MARKETPLACES = ["amazon", "tiktok_shop", "mercadolibre", "google_merchant"] as const
const COUNTRIES = ["US", "BR", "FR", "DE", "UK"] as const

type SubRow = {
  id: string
  channel: string
  active: boolean
  hasWebhook: boolean
  filters: unknown
}

export default function RadarAlertSettingsClient({
  subscriptions,
}: {
  subscriptions: SubRow[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [webhookUrl, setWebhookUrl] = useState("")
  const [minSeverity, setMinSeverity] = useState<Severity>("medium")
  const [marketplaces, setMarketplaces] = useState<string[]>(["amazon", "tiktok_shop"])
  const [countries, setCountries] = useState<string[]>(["US", "BR", "FR"])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function toggle(list: string[], value: string, setter: (v: string[]) => void) {
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value])
  }

  function save() {
    setMessage(null)
    setError(null)
    const filters: AlertSubscriptionFilters = {
      marketplaces,
      countries,
      minSeverity,
    }
    startTransition(async () => {
      const res = await fetch("/api/radar/alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channel: "slack",
          webhookUrl: webhookUrl.trim() || undefined,
          filters,
          active: true,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(json.error ?? `Erreur ${res.status}`)
        return
      }
      setMessage("Abonnement Slack enregistré (webhook chiffré).")
      setWebhookUrl("")
      router.refresh()
    })
  }

  function sendTest() {
    setMessage(null)
    setError(null)
    startTransition(async () => {
      const res = await fetch("/api/radar/alerts/test", { method: "POST" })
      const json = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean }
      if (!res.ok) {
        setError(json.error ?? `Erreur ${res.status}`)
        return
      }
      setMessage("Message test envoyé sur Slack.")
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">⚙️ Alertes — Slack</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Branche un Incoming Webhook Slack pour recevoir les WINNER DETECTED (analyse quotidienne).
          </p>
        </div>
        <Link href="/radar/alerts" className="text-sm font-medium text-violet-600">
          ← Alertes
        </Link>
      </div>

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium text-zinc-800">
          Slack webhook URL
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://hooks.slack.com/services/…"
            className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
            autoComplete="off"
          />
        </label>

        <div>
          <p className="text-sm font-medium text-zinc-800">Marketplaces</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {MARKETPLACES.map((m) => (
              <label key={m} className="flex items-center gap-1.5 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={marketplaces.includes(m)}
                  onChange={() => toggle(marketplaces, m, setMarketplaces)}
                />
                {m}
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-zinc-800">Countries</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {COUNTRIES.map((c) => (
              <label key={c} className="flex items-center gap-1.5 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={countries.includes(c)}
                  onChange={() => toggle(countries, c, setCountries)}
                />
                {c}
              </label>
            ))}
          </div>
        </div>

        <label className="block text-sm font-medium text-zinc-800">
          Min severity
          <select
            value={minSeverity}
            onChange={(e) => setMinSeverity(e.target.value as Severity)}
            className="mt-1 rounded-md border border-zinc-200 px-3 py-2 text-sm"
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="critical">critical</option>
          </select>
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            Enregistrer
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={sendTest}
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
          >
            Test Slack
          </button>
        </div>

        {message && <p className="text-sm text-emerald-700">{message}</p>}
        {error && <p className="text-sm text-red-700">{error}</p>}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900">Abonnements</h3>
        {subscriptions.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">Aucun abonnement pour l’instant.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {subscriptions.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm"
              >
                <span>
                  {s.channel} · {s.active ? "actif" : "inactif"} · webhook{" "}
                  {s.hasWebhook ? "✓" : "—"}
                </span>
                <code className="text-[11px] text-zinc-500">{s.id.slice(0, 10)}…</code>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

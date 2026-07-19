"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

type HealthPayload = {
  slack?: boolean
  resend?: boolean
  alertsApiKey?: boolean
}

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <p className="text-xs text-zinc-500">{label}</p>
      <p
        className={`mt-1 text-sm font-medium ${
          ok ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-300"
        }`}
      >
        {ok ? "Configured" : "Missing"}
      </p>
    </div>
  )
}

/** Alert channel status + Test Slack (ADMIN session → /api/radar/alerts/send). */
export function AdminRadarAlertChannels() {
  const [health, setHealth] = useState<HealthPayload | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/radar/health", { credentials: "include" })
        if (!res.ok) return
        const data = (await res.json()) as HealthPayload
        if (!cancelled) setHealth(data)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function testSlack() {
    setLoading(true)
    try {
      const res = await fetch("/api/radar/alerts/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "slack",
          type: "WINNER_NEW",
          title: "Admin QA — Test Slack Alert",
          message: "Test depuis /admin/radar — canal Slack OK.",
        }),
      })
      const data = (await res.json()) as {
        error?: string
        message?: string
        slack?: { sent?: boolean }
      }

      if (res.status === 401) {
        toast.error(data.message ?? "Missing x-api-key / ADMIN session")
        return
      }
      if (res.status === 503 && data.error === "SLACK_NOT_CONFIGURED") {
        toast.error("Plan Slack non configuré — ajoute SLACK_WEBHOOK_URL")
        return
      }
      if (!res.ok) {
        toast.error(data.message ?? data.error ?? `HTTP ${res.status}`)
        return
      }
      toast.success(data.slack?.sent ? "Slack test envoyé" : "OK")
    } catch {
      toast.error("Échec test Slack")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Alert Channels</p>
      <p className="mt-1 text-xs text-zinc-500">
        Envoi machine : <code className="text-[11px]">POST /api/radar/alerts/send</code> +{" "}
        <code className="text-[11px]">x-api-key</code>. Sans clé → 401. Sans Slack → 503.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Status ok={Boolean(health?.slack)} label="Slack" />
        <Status ok={Boolean(health?.resend)} label="Email (Resend)" />
        <Status ok={Boolean(health?.alertsApiKey)} label="API Key" />
      </div>
      <button
        type="button"
        disabled={loading}
        onClick={() => void testSlack()}
        className="mt-3 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-60"
      >
        {loading ? "Envoi…" : "Test Slack Alert"}
      </button>
    </div>
  )
}

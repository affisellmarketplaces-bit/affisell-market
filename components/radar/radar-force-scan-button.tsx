"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

export default function RadarForceScanButton({
  disabled = false,
  label = "Forcer Scan",
}: {
  disabled?: boolean
  label?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function onForceScan() {
    if (disabled) return
    setMessage(null)
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch("/api/radar/scan", { method: "POST" })
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          scanned?: number
          new?: number
          skipped?: boolean
          reason?: string
          error?: string
        }
        if (!res.ok) {
          setError(json.error ?? `Erreur ${res.status}`)
          return
        }
        if (json.skipped) {
          setMessage(`Scan ignoré (${json.reason ?? "skipped"})`)
          return
        }
        setMessage(`Scan OK — ${json.scanned ?? 0} lus, ${json.new ?? 0} nouveaux`)
        router.refresh()
      } catch {
        setError("Scan impossible (réseau)")
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onForceScan}
        disabled={disabled || pending}
        title={disabled ? "Configure les clés crawler pour activer le scan" : undefined}
        className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Scan en cours…" : label}
      </button>
      {message && <p className="text-xs text-emerald-700">{message}</p>}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  )
}

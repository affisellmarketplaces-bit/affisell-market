"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

/**
 * Force Scan — always clickable (except while pending).
 * Parent may pass `disabled` as a soft hint (empty DB / missing P1 keys);
 * we still run degraded Amazon/local scan via POST /api/radar/scan.
 */
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
          degraded?: boolean
          missingOptional?: string[]
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
        const degradedNote = json.degraded
          ? ` · mode dégradé (${(json.missingOptional ?? []).join(", ") || "clés P1 absentes"})`
          : ""
        setMessage(
          `Scan OK — ${json.scanned ?? 0} lus, ${json.new ?? 0} nouveaux${degradedNote}`
        )
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
        disabled={pending}
        title={
          disabled
            ? "Mode dégradé disponible : Amazon/local sans TikTok/Serper"
            : undefined
        }
        className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Scan en cours…" : label}
      </button>
      {message && <p className="text-xs text-emerald-700">{message}</p>}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  )
}

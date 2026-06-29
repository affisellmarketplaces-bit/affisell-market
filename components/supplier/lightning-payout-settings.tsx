"use client"

import { Loader2, Zap } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"

type Props = {
  initialTrustScore: number
  initialLightningEnabled: boolean
}

function LightningToggle({
  on,
  disabled,
  busy,
  title,
  onChange,
}: {
  on: boolean
  disabled?: boolean
  busy?: boolean
  title?: string
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Activer Lightning Payout"
      title={title}
      disabled={disabled || busy}
      onClick={() => onChange(!on)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        on
          ? "border-violet-500/50 bg-violet-600"
          : "border-zinc-300 bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800"
      )}
    >
      <span
        className={cn(
          "inline-block size-5 transform rounded-full bg-white shadow transition-transform",
          on ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  )
}

export function LightningPayoutSettings({ initialTrustScore, initialLightningEnabled }: Props) {
  const [trustScore, setTrustScore] = useState(initialTrustScore)
  const [lightningEnabled, setLightningEnabled] = useState(initialLightningEnabled)
  const [busy, setBusy] = useState(false)

  const locked = trustScore < 50
  const lockTooltip = "Expédiez 10 commandes sans litige pour débloquer"
  const switchDisabled = locked && !lightningEnabled

  async function onToggle(next: boolean) {
    if (next && locked) return
    setBusy(true)
    try {
      const res = await fetch("/api/supplier/lightning-payout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ lightningEnabled: next }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        trustScore?: number
        lightningEnabled?: boolean
      }
      if (!res.ok) {
        toast.error(
          data.error === "trust_score_too_low"
            ? lockTooltip
            : "Impossible de mettre à jour Lightning Payout"
        )
        if (typeof data.trustScore === "number") setTrustScore(data.trustScore)
        return
      }
      if (typeof data.trustScore === "number") setTrustScore(data.trustScore)
      if (typeof data.lightningEnabled === "boolean") setLightningEnabled(data.lightningEnabled)
      toast.success(next ? "Lightning Payout activé" : "Lightning Payout désactivé")
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
              <Zap className="size-4" aria-hidden />
            </span>
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                Activer Lightning Payout
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Reversement instantané dès l&apos;expédition (supplier + affilié) si votre score de
                confiance est suffisant.
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            Score de confiance :{" "}
            <span className="font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
              {trustScore}/100
            </span>
            {locked ? (
              <span className="mt-1 block text-amber-700 dark:text-amber-300">{lockTooltip}</span>
            ) : null}
          </p>
        </div>

        <div className="flex items-center gap-3 sm:pt-1">
          {busy ? <Loader2 className="size-4 animate-spin text-zinc-400" aria-hidden /> : null}
          <LightningToggle
            on={lightningEnabled}
            busy={busy}
            disabled={switchDisabled}
            title={switchDisabled ? lockTooltip : undefined}
            onChange={(next) => void onToggle(next)}
          />
        </div>
      </div>
    </section>
  )
}

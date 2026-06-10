"use client"

import { useState } from "react"

import { AGENT_MIN_WITHDRAW_CENTS } from "@/lib/agents/agent-payout-shared"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  balanceCents: number
  connectOnboarded: boolean
  agentPaused: boolean
}

export function AgentPayoutPanel({ balanceCents, connectOnboarded, agentPaused }: Props) {
  const [loading, setLoading] = useState<"connect" | "withdraw" | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canWithdraw =
    !agentPaused &&
    connectOnboarded &&
    balanceCents >= AGENT_MIN_WITHDRAW_CENTS

  async function startConnect() {
    setLoading("connect")
    setError(null)
    setMessage(null)
    try {
      const res = await fetch("/api/stripe/connect/create-account", { method: "POST" })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        setError(data.error ?? "Impossible de démarrer Stripe Connect")
        return
      }
      window.location.href = data.url
    } catch {
      setError("Erreur réseau — réessayez")
    } finally {
      setLoading(null)
    }
  }

  async function withdrawAll() {
    setLoading("withdraw")
    setError(null)
    setMessage(null)
    try {
      const res = await fetch("/api/agent/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({}),
      })
      const data = (await res.json()) as {
        ok?: boolean
        amountCents?: number
        error?: string
        idempotent?: boolean
      }
      if (!res.ok) {
        const labels: Record<string, string> = {
          connect_required: "Activez Stripe Connect avant de retirer.",
          below_minimum: `Minimum ${(AGENT_MIN_WITHDRAW_CENTS / 100).toFixed(2)} €.`,
          insufficient_balance: "Solde insuffisant.",
          agent_not_active: "Compte agent en pause.",
        }
        setError(labels[data.error ?? ""] ?? data.error ?? "Retrait impossible")
        return
      }
      const amount = ((data.amountCents ?? 0) / 100).toFixed(2)
      setMessage(
        data.idempotent
          ? `Retrait déjà effectué (${amount} €).`
          : `Retrait de ${amount} € envoyé sur votre compte Stripe.`
      )
      window.location.reload()
    } catch {
      setError("Erreur réseau — réessayez")
    } finally {
      setLoading(null)
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Retrait Stripe Connect</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Solde disponible {(balanceCents / 100).toFixed(2)} € · minimum{" "}
        {(AGENT_MIN_WITHDRAW_CENTS / 100).toFixed(2)} €
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {!connectOnboarded ? (
          <button
            type="button"
            disabled={loading !== null || agentPaused}
            onClick={() => void startConnect()}
            className={cn(buttonVariants({ size: "sm" }), "bg-cyan-600 text-white hover:bg-cyan-700")}
          >
            {loading === "connect" ? "Redirection…" : "Activer Stripe Connect"}
          </button>
        ) : (
          <button
            type="button"
            disabled={!canWithdraw || loading !== null}
            onClick={() => void withdrawAll()}
            className={cn(buttonVariants({ size: "sm" }), "bg-emerald-600 text-white hover:bg-emerald-700")}
          >
            {loading === "withdraw" ? "Retrait…" : "Retirer tout le solde"}
          </button>
        )}
      </div>
      {connectOnboarded ? (
        <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">Stripe Connect actif</p>
      ) : null}
      {message ? <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">{message}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </section>
  )
}

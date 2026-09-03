"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import {
  PayoutMethodCard,
  type AffiliatePayoutMethodCardModel,
} from "@/components/affiliate/PayoutMethodCard"

type Props = {
  methods: AffiliatePayoutMethodCardModel[]
}

export function PayoutMethodsGrid({ methods: initialMethods }: Props) {
  const router = useRouter()
  const [methods, setMethods] = useState(initialMethods)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSetDefault(id: string) {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch("/api/affiliate/payout-methods", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "setDefault" }),
      })
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error ?? "Impossible de définir la méthode par défaut")
      }
      setMethods((prev) =>
        prev.map((m) => ({
          ...m,
          isDefault: m.id === id,
        }))
      )
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur")
    } finally {
      setBusyId(null)
    }
  }

  async function onDelete(id: string) {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/affiliate/payout-methods?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error ?? "Impossible de supprimer")
      }
      setMethods((prev) => {
        const next = prev.filter((m) => m.id !== id)
        if (next.length > 0 && !next.some((m) => m.isDefault)) {
          next[0] = { ...next[0]!, isDefault: true }
        }
        return next
      })
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {methods.map((method) => (
          <PayoutMethodCard
            key={method.id}
            method={method}
            onSetDefault={onSetDefault}
            onDelete={onDelete}
            busyId={busyId}
          />
        ))}
      </div>
    </div>
  )
}

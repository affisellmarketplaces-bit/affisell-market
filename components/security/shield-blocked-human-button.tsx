"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type ShieldBlockedHumanButtonProps = {
  ip: string
}

export function ShieldBlockedHumanButton({ ip }: ShieldBlockedHumanButtonProps) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleHumanClaim() {
    if (busy || !ip || ip === "—") {
      router.push("/")
      return
    }
    setBusy(true)
    try {
      await fetch("/api/security/logs", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unban", ip }),
      })
    } catch {
      // redirect anyway — rate-limit ban cleared when possible
    } finally {
      router.push("/")
      router.refresh()
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void handleHumanClaim()}
      className="mt-4 inline-flex items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 px-6 py-2.5 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100 disabled:opacity-60"
    >
      {busy ? "Vérification…" : "Je suis humain →"}
    </button>
  )
}

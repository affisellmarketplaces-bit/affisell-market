"use client"

import { useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"

import { useSafeAppRouter } from "@/hooks/use-safe-app-router"

type Props = {
  upgrade?: string
  sessionId?: string
}

/** Activates Radar plan after Stripe redirect (?upgrade=success). */
export function PricingUpgradeToast({ upgrade, sessionId }: Props) {
  const { replace, mounted } = useSafeAppRouter()
  const { update } = useSession()
  const shown = useRef(false)

  useEffect(() => {
    if (!mounted || shown.current || !upgrade) return
    shown.current = true

    if (upgrade === "success") {
      void (async () => {
        try {
          const res = await fetch("/api/stripe/verify-radar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(sessionId ? { sessionId } : {}),
          })
          const data = (await res.json()) as {
            radarPlan?: string
            activated?: boolean
            error?: string
          }
          if (!res.ok) {
            throw new Error(data.error ?? "Activation Radar impossible")
          }
          toast.success(
            data.radarPlan === "global"
              ? "Radar Global activé — winners mondiaux débloqués"
              : "Radar Pro activé — winners live débloqués"
          )
          await update()
        } catch (e) {
          toast.error(
            e instanceof Error
              ? e.message
              : "Paiement reçu — l’activation Radar peut prendre quelques minutes"
          )
        }
        replace("/pricing?feature=radar")
        if (typeof window !== "undefined") window.location.reload()
      })()
      return
    }

    if (upgrade === "cancelled") {
      toast.message("Upgrade Radar annulé")
      replace("/pricing?feature=radar")
    }
  }, [mounted, upgrade, replace, sessionId, update])

  return null
}
